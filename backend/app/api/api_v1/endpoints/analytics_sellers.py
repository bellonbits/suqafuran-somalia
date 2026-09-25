"""
Analytics Endpoints for Sellers - Dashboard metrics and tracking.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.db.session import get_db
from app.services.analytics_service import analytics_service
from app.api.deps import get_current_user
from app.core.logging_config import get_logger

logger = get_logger("analytics_sellers_api")

router = APIRouter(prefix="/analytics", tags=["analytics-sellers"])


# TRACKING ENDPOINT (Public - used by frontend to log events)
@router.post("/track")
async def track_event(
    event_type: str = Query(...),
    seller_id: int = Query(...),
    listing_id: int = Query(None),
    source: str = Query(None),
    search_query: str = Query(None),
    session: Session = Depends(get_db),
):
    """
    Track an analytics event.

    This endpoint is intentionally public (no auth) so frontend can track events
    from any page without auth state. The seller_id is passed as query param.

    Query Parameters:
    - event_type: shop_visit, product_view, product_click, whatsapp_click, call_click, message_click, follow_shop
    - seller_id: The shop owner ID
    - listing_id: Product ID (optional)
    - source: Where visitor came from (search, category, homepage, direct)
    - search_query: Search term if from search
    """
    success = analytics_service.track_event(
        seller_id=seller_id,
        event_type=event_type,
        listing_id=listing_id,
        source=source,
        search_query=search_query,
        session=session,
    )

    if not success:
        raise HTTPException(status_code=400, detail="Failed to track event")

    return {"status": "success", "message": "Event tracked"}


# SELLER DASHBOARD ENDPOINTS
@router.get("/sellers/{seller_id}/summary")
async def get_analytics_summary(
    seller_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get analytics summary for seller dashboard."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    metrics = analytics_service.get_seller_metrics(
        seller_id=seller_id,
        days=days,
        session=session,
    )

    return {
        "status": "success",
        "metrics": metrics,
    }


@router.get("/sellers/{seller_id}/daily")
async def get_daily_metrics(
    seller_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get daily breakdown of metrics."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    daily_metrics = analytics_service.get_daily_metrics(
        seller_id=seller_id,
        days=days,
        session=session,
    )

    return {
        "status": "success",
        "daily_metrics": daily_metrics,
    }


@router.get("/sellers/{seller_id}/products/{listing_id}")
async def get_product_metrics(
    seller_id: int,
    listing_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get metrics for a specific product."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    metrics = analytics_service.get_product_metrics(
        seller_id=seller_id,
        listing_id=listing_id,
        days=days,
        session=session,
    )

    return {
        "status": "success",
        "product_metrics": metrics,
    }


@router.get("/sellers/{seller_id}/deals-summary")
async def get_deals_summary(
    seller_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Purchase-confirmation counts (pending/confirmed/denied) for a seller's
    own dashboard -- sourced directly from Deal, not the generic event pipeline."""
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.models.meeting_deal import Deal

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    outcomes = session.exec(
        select(Deal.outcome, func.count(Deal.id))
        .where(Deal.seller_id == seller_id, Deal.created_at >= cutoff_date)
        .group_by(Deal.outcome)
    ).all()
    counts = {outcome: count for outcome, count in outcomes}

    return {
        "status": "success",
        "deals_summary": {
            "pending": counts.get("pending", 0),
            "confirmed": counts.get("bought", 0),
            "denied": counts.get("not_bought", 0),
        },
    }
