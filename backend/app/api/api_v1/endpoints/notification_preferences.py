"""Notification preferences endpoints."""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.api import deps
from app.models.notification_preferences import (
    NotificationPreferences,
    NotificationPreferencesRead,
    NotificationPreferencesUpdate,
)
from app.models.user import User
from app.crud.crud_notification_preferences import crud_notification_preferences

router = APIRouter()


@router.get("/", response_model=NotificationPreferencesRead)
def get_notification_preferences(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get notification preferences for current user.
    """
    prefs = crud_notification_preferences.get_or_create(db, current_user.id)
    return prefs


@router.patch("/", response_model=NotificationPreferencesRead)
def update_notification_preferences(
    *,
    db: Session = Depends(deps.get_db),
    prefs_in: NotificationPreferencesUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update notification preferences.
    """
    prefs = crud_notification_preferences.get_or_create(db, current_user.id)

    prefs = crud_notification_preferences.update(
        db,
        db_obj=prefs,
        obj_in=prefs_in.model_dump(exclude_unset=True),
    )

    return prefs


@router.post("/disable-all")
def disable_all_notifications(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Disable all notifications at once.
    """
    prefs = crud_notification_preferences.get_or_create(db, current_user.id)

    prefs.email_messages = False
    prefs.email_offers = False
    prefs.email_price_drops = False
    prefs.email_search_matches = False
    prefs.email_order_updates = False
    prefs.email_listings = False

    db.add(prefs)
    db.commit()
    db.refresh(prefs)

    return {"message": "All notifications disabled", "preferences": prefs}


@router.post("/enable-all")
def enable_all_notifications(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Enable all notifications at once.
    """
    prefs = crud_notification_preferences.get_or_create(db, current_user.id)

    prefs.email_messages = True
    prefs.email_offers = True
    prefs.email_price_drops = True
    prefs.email_search_matches = True
    prefs.email_order_updates = True
    prefs.email_listings = True

    db.add(prefs)
    db.commit()
    db.refresh(prefs)

    return {"message": "All notifications enabled", "preferences": prefs}
