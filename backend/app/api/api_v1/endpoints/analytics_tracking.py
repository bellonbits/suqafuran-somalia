"""Analytics event tracking endpoints (lightweight, async)."""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from sqlmodel import Session
from datetime import datetime
from typing import Optional
from app.api import deps
from app.models.analytics import UserActivity, ClickEvent, UserSession
from app.models.user import User
import json

router = APIRouter()


@router.post("/track/click")
async def track_click(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
):
    """
    Track click events (lightweight, batched in background).
    Can be called without authentication (anonymous tracking).
    """
    try:
        data = await request.json()

        # Process in background to avoid blocking
        async def save_click():
            try:
                click = ClickEvent(
                    user_id=data.get("user_id"),
                    session_id=data.get("session_token"),
                    element_id=data.get("element_id"),
                    element_class=data.get("element_class"),
                    element_type=data.get("element_type", "unknown"),
                    text=data.get("text"),
                    x=int(data.get("x", 0)),
                    y=int(data.get("y", 0)),
                    page_url=data.get("page_url", ""),
                    page_width=int(data.get("page_width", 1024)),
                    page_height=int(data.get("page_height", 768)),
                    timestamp=datetime.utcnow(),
                )
                db.add(click)
                db.commit()
            except Exception as e:
                print(f"Error saving click event: {e}")

        background_tasks.add_task(save_click)
        return {"status": "received"}

    except Exception as e:
        print(f"Error in track_click: {e}")
        return {"status": "error"}


@router.post("/track/metric")
async def track_metric(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db),
):
    """
    Track custom metrics (time on page, scroll depth, etc).
    """
    try:
        data = await request.json()

        # Process in background
        async def save_metric():
            try:
                activity = UserActivity(
                    user_id=current_user.id if current_user else None,
                    session_id=data.get("session_token"),
                    action_type=data.get("metric_name", "metric"),
                    action_category="metrics",
                    page_url=data.get("page_url", ""),
                    event_metadata=data.get("metric_data", "{}"),
                    timestamp=datetime.utcnow(),
                    ip_address=request.client.host if request.client else None,
                )
                db.add(activity)
                db.commit()
            except Exception as e:
                print(f"Error saving metric: {e}")

        background_tasks.add_task(save_metric)
        return {"status": "received"}

    except Exception as e:
        print(f"Error in track_metric: {e}")
        return {"status": "error"}


@router.post("/track/activity")
async def track_activity(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db),
):
    """
    Track user activities (search, view, purchase, etc).
    Works for both authenticated and anonymous users.
    """
    try:
        data = await request.json()

        # Process in background
        async def save_activity():
            try:
                activity = UserActivity(
                    user_id=current_user.id if current_user else None,
                    session_id=data.get("session_token"),
                    action_type=data.get("action_type", "unknown"),
                    action_category=data.get("action_category", "other"),
                    resource_id=data.get("resource_id"),
                    page_url=data.get("page_url", ""),
                    search_query=data.get("search_query"),
                    timestamp=datetime.utcnow(),
                    ip_address=request.client.host if request.client else None,
                )
                db.add(activity)
                db.commit()

                # Update conversion funnel if user is authenticated
                if current_user:
                    from app.models.analytics import ConversionFunnel

                    funnel = db.query(ConversionFunnel).filter(
                        ConversionFunnel.user_id == current_user.id
                    ).first()

                    if not funnel:
                        funnel = ConversionFunnel(user_id=current_user.id)
                        db.add(funnel)

                    # Update funnel stage based on action
                    if activity.action_type == "search":
                        if not funnel.first_search_at:
                            funnel.first_search_at = datetime.utcnow()
                            funnel.current_stage = "search"
                    elif activity.action_type == "view_listing":
                        if not funnel.first_view_listing_at:
                            funnel.first_view_listing_at = datetime.utcnow()
                            funnel.current_stage = "view"
                    elif activity.action_type == "add_to_cart":
                        if not funnel.first_add_to_cart_at:
                            funnel.first_add_to_cart_at = datetime.utcnow()
                            funnel.current_stage = "cart"
                    elif activity.action_type == "purchase":
                        if not funnel.first_purchase_at:
                            funnel.first_purchase_at = datetime.utcnow()
                            funnel.current_stage = "purchase"
                            funnel.completed = True
                        elif funnel.repeat_purchase_at is None:
                            funnel.repeat_purchase_at = datetime.utcnow()

                    funnel.updated_at = datetime.utcnow()
                    db.add(funnel)
                    db.commit()

            except Exception as e:
                print(f"Error saving activity: {e}")

        background_tasks.add_task(save_activity)
        return {"status": "received"}

    except Exception as e:
        print(f"Error in track_activity: {e}")
        return {"status": "error"}
