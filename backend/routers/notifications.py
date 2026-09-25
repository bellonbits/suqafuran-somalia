from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from models import (
    Notification,
    NotificationPreference,
    NotificationLog,
    User,
    NotificationStatus,
)
from schemas import (
    NotificationCreate,
    NotificationResponse,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from database import get_db
from utils.security import get_current_user
from services.notification_service import send_notification_async

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/send", response_model=dict)
async def send_notification(
    payload: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a notification through multiple channels.
    Handles both in-app and external channels (email, SMS, push).
    """
    try:
        # Create in-app notification
        notification = Notification(
            user_id=current_user.id,
            type=payload.type,
            title=payload.title,
            message=payload.message,
            status=NotificationStatus.UNREAD,
            action_url=payload.action_url,
            action_label=payload.action_label,
            data=payload.data,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # Get user preferences
        preferences = (
            db.query(NotificationPreference)
            .filter(NotificationPreference.user_id == current_user.id)
            .first()
        )

        # Queue external notifications (email, SMS, push) via Celery
        if preferences:
            external_channels = [
                ch for ch in payload.channels if ch != "in-app"
            ]
            if external_channels:
                send_notification_async.delay(
                    notification_id=notification.id,
                    user_id=current_user.id,
                    channels=external_channels,
                    preferences={
                        "email": preferences.email_notifications,
                        "sms": preferences.sms_notifications,
                        "push": preferences.push_notifications,
                    },
                )

        return {
            "success": True,
            "message": "Notification sent successfully",
            "notification_id": notification.id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[NotificationListResponse])
async def list_notifications(
    status: str = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List user's notifications with optional filtering by status.
    """
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )

    if status:
        if status not in ["unread", "read", "archived"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.filter(Notification.status == status)

    # Don't show archived by default
    if not status:
        query = query.filter(Notification.status != NotificationStatus.ARCHIVED)

    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return notifications


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a single notification by ID.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Mark as read if unread
    if notification.status == NotificationStatus.UNREAD:
        notification.status = NotificationStatus.READ
        db.commit()
        db.refresh(notification)

    return notification


@router.patch("/{notification_id}/read", response_model=dict)
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a notification as read.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.status = NotificationStatus.READ
    notification.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Notification marked as read"}


@router.patch("/{notification_id}/archive", response_model=dict)
async def archive_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Archive a notification.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.status = NotificationStatus.ARCHIVED
    notification.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Notification archived"}


@router.delete("/{notification_id}", response_model=dict)
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a notification permanently.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Also delete logs
    db.query(NotificationLog).filter(
        NotificationLog.notification_id == notification_id
    ).delete()

    db.delete(notification)
    db.commit()

    return {"success": True, "message": "Notification deleted"}


@router.post("/preferences", response_model=NotificationPreferenceResponse)
async def save_preferences(
    preferences: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save or update user notification preferences.
    """
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        # Create default preferences if not exists
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    # Update only provided fields
    update_data = preferences.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)

    pref.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pref)

    return pref


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user's notification preferences.
    """
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        # Create default preferences if not exists
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return pref


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    preferences: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update user notification preferences (PATCH).
    """
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    update_data = preferences.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)

    pref.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pref)

    return pref
