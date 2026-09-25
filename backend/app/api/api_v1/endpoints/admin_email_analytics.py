"""Admin endpoints for email campaign analytics and performance tracking."""

from typing import Any, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from app.api import deps
from app.models.user import User
from app.models.marketing import EmailCampaign, EmailEventType
from pydantic import BaseModel

router = APIRouter()


class EmailStatsResponse(BaseModel):
    total_sent: int
    total_opened: int
    total_clicked: int
    open_rate: float
    click_rate: float
    by_event_type: dict
    by_date: list


class EmailCampaignResponse(BaseModel):
    id: int
    user_id: int
    event_type: str
    subject: str
    template_name: str
    sent_at: str
    opened_at: Optional[str] = None
    clicked_at: Optional[str] = None
    status: str


class EmailCampaignsListResponse(BaseModel):
    campaigns: list[EmailCampaignResponse]
    total: int


def _check_admin_permission(current_user: User):
    """Verify user has admin or agent permission."""
    if not (current_user.is_admin or current_user.is_agent):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and agents can view email analytics"
        )


@router.get("/stats", response_model=EmailStatsResponse)
def get_email_stats(
    period: str = "week",
    event_type: str = "all",
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get email campaign statistics and performance metrics.

    Query Parameters:
    - period: 'week' (7 days), 'month' (30 days), or 'all' (all time)
    - event_type: specific event type or 'all'
    """
    _check_admin_permission(current_user)

    # Determine date range
    if period == "week":
        since = datetime.utcnow() - timedelta(days=7)
    elif period == "month":
        since = datetime.utcnow() - timedelta(days=30)
    else:
        since = None

    # Build base query
    query = select(EmailCampaign)
    if since:
        query = query.where(EmailCampaign.sent_at >= since)
    if event_type != "all":
        query = query.where(EmailCampaign.event_type == event_type)

    campaigns = db.exec(query).all()

    # Calculate stats
    total_sent = len(campaigns)
    total_opened = sum(1 for c in campaigns if c.opened_at)
    total_clicked = sum(1 for c in campaigns if c.clicked_at)
    open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0
    click_rate = (total_clicked / total_sent * 100) if total_sent > 0 else 0

    # Group by event type
    by_event_type = {}
    for event in EmailEventType:
        event_campaigns = [c for c in campaigns if c.event_type == event.value]
        if event_campaigns:
            event_opened = sum(1 for c in event_campaigns if c.opened_at)
            event_clicked = sum(1 for c in event_campaigns if c.clicked_at)
            event_sent = len(event_campaigns)
            by_event_type[event.value] = {
                "sent": event_sent,
                "opened": event_opened,
                "clicked": event_clicked,
                "open_rate": (event_opened / event_sent * 100) if event_sent > 0 else 0,
                "click_rate": (event_clicked / event_sent * 100) if event_sent > 0 else 0,
            }

    # Group by date
    by_date = {}
    for campaign in campaigns:
        date_key = campaign.sent_at.date().isoformat()
        if date_key not in by_date:
            by_date[date_key] = {"sent": 0, "opened": 0, "clicked": 0}
        by_date[date_key]["sent"] += 1
        if campaign.opened_at:
            by_date[date_key]["opened"] += 1
        if campaign.clicked_at:
            by_date[date_key]["clicked"] += 1

    by_date_list = [
        {
            "date": date,
            **stats
        }
        for date, stats in sorted(by_date.items())
    ]

    return {
        "total_sent": total_sent,
        "total_opened": total_opened,
        "total_clicked": total_clicked,
        "open_rate": open_rate,
        "click_rate": click_rate,
        "by_event_type": by_event_type,
        "by_date": by_date_list,
    }


@router.get("/campaigns", response_model=EmailCampaignsListResponse)
def get_email_campaigns(
    period: str = "week",
    event_type: str = "all",
    limit: int = 50,
    offset: int = 0,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get list of email campaigns with filtering and pagination.

    Query Parameters:
    - period: 'week', 'month', or 'all'
    - event_type: specific event type or 'all'
    - limit: number of results (max 100)
    - offset: pagination offset
    """
    _check_admin_permission(current_user)

    # Clamp limit
    limit = min(limit, 100)

    # Determine date range
    if period == "week":
        since = datetime.utcnow() - timedelta(days=7)
    elif period == "month":
        since = datetime.utcnow() - timedelta(days=30)
    else:
        since = None

    # Build query
    query = select(EmailCampaign).order_by(EmailCampaign.sent_at.desc())
    if since:
        query = query.where(EmailCampaign.sent_at >= since)
    if event_type != "all":
        query = query.where(EmailCampaign.event_type == event_type)

    total = db.exec(select(func.count()).select_from(EmailCampaign)).first() or 0

    # Apply pagination
    query = query.offset(offset).limit(limit)
    campaigns = db.exec(query).all()

    # Convert to response models
    campaign_responses = [
        EmailCampaignResponse(
            id=c.id,
            user_id=c.user_id,
            event_type=c.event_type,
            subject=c.subject,
            template_name=c.template_name,
            sent_at=c.sent_at.isoformat(),
            opened_at=c.opened_at.isoformat() if c.opened_at else None,
            clicked_at=c.clicked_at.isoformat() if c.clicked_at else None,
            status="sent",
        )
        for c in campaigns
    ]

    return {
        "campaigns": campaign_responses,
        "total": total,
    }


@router.post("/{campaign_id}/mark-opened")
def mark_campaign_opened(
    campaign_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Mark an email campaign as opened (called via email pixel tracking)."""
    campaign = db.get(EmailCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.opened_at = datetime.utcnow()
    db.add(campaign)
    db.commit()

    return {"status": "marked_opened"}


@router.post("/{campaign_id}/mark-clicked")
def mark_campaign_clicked(
    campaign_id: int,
    link: Optional[str] = None,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Mark an email campaign link as clicked."""
    campaign = db.get(EmailCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.clicked_at = datetime.utcnow()
    if link:
        campaign.clicked_link = link
    db.add(campaign)
    db.commit()

    return {"status": "marked_clicked"}
