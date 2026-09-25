"""Admin endpoints for managing advertising campaigns and homepage banners."""

from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.api import deps
from app.models.advertising import (
    HomepageBanner,
    HomepageBannerStats,
    BannerStatus,
    Advertisement,
    AdvertisementStatus,
)
from app.models.user import User
from pydantic import BaseModel

router = APIRouter(tags=["admin-advertising"])


def _banner_fields(banner: HomepageBanner) -> dict:
    """
    Explicit field extraction instead of banner.dict() — SQLModel's .dict()
    can return an empty dict right after an insert + commit + refresh cycle,
    even though the ORM attributes themselves are populated correctly.
    """
    return {
        "id": banner.id,
        "seller_id": banner.seller_id,
        "title": banner.title,
        "subtitle": banner.subtitle,
        "image_url": banner.image_url,
        "mobile_image_url": banner.mobile_image_url,
        "button_text": banner.button_text,
        "button_link": banner.button_link,
        "start_date": banner.start_date,
        "end_date": banner.end_date,
        "priority": banner.priority,
        "status": banner.status,
        "created_at": banner.created_at,
        "updated_at": banner.updated_at,
    }


# ============================================================================
# Pydantic Schemas
# ============================================================================

class CreateBannerRequest(BaseModel):
    seller_id: int
    title: str
    subtitle: str | None = None
    image_url: str
    mobile_image_url: str | None = None
    button_text: str = "Shop Now"
    button_link: str
    start_date: datetime
    end_date: datetime
    priority: int = 50


class UpdateBannerRequest(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    image_url: str | None = None
    mobile_image_url: str | None = None
    button_text: str | None = None
    button_link: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    priority: int | None = None
    status: str | None = None


class BannerResponse(BaseModel):
    id: int
    seller_id: int
    title: str
    subtitle: str | None
    image_url: str
    mobile_image_url: str | None
    button_text: str
    button_link: str
    start_date: datetime
    end_date: datetime
    priority: int
    status: str
    created_at: datetime
    updated_at: datetime


class BannerDetailResponse(BannerResponse):
    stats: dict | None = None  # impressions, clicks, ctr


class AdvertisingStatsResponse(BaseModel):
    total_campaigns: int
    active_campaigns: int
    expired_campaigns: int
    total_revenue: float
    avg_campaign_cost: float
    by_placement_type: dict


# ============================================================================
# Admin Banner Management Endpoints
# ============================================================================

@router.post("/banners", response_model=BannerResponse)
def create_homepage_banner(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_in: CreateBannerRequest,
) -> Any:
    """
    Create a new homepage banner (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = HomepageBanner(
        seller_id=banner_in.seller_id,
        title=banner_in.title,
        subtitle=banner_in.subtitle,
        image_url=banner_in.image_url,
        mobile_image_url=banner_in.mobile_image_url,
        button_text=banner_in.button_text,
        button_link=banner_in.button_link,
        start_date=banner_in.start_date,
        end_date=banner_in.end_date,
        priority=banner_in.priority,
        status=BannerStatus.DRAFT,
        created_by_admin_id=current_user.id,
    )

    db.add(banner)
    db.commit()
    db.refresh(banner)

    # Create stats record
    stats = HomepageBannerStats(banner_id=banner.id)
    db.add(stats)
    db.commit()

    return BannerResponse(**_banner_fields(banner))


@router.get("/banners", response_model=List[BannerDetailResponse])
def list_homepage_banners(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    status: str | None = Query(None),
    limit: int = Query(50, le=100),
) -> Any:
    """
    List all homepage banners with optional status filter (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    query = select(HomepageBanner)

    if status:
        query = query.where(HomepageBanner.status == status)

    query = query.order_by(HomepageBanner.priority.desc(), HomepageBanner.created_at.desc()).limit(limit)
    banners = db.exec(query).all()

    result = []
    for banner in banners:
        stats = db.exec(select(HomepageBannerStats).where(HomepageBannerStats.banner_id == banner.id)).first()
        ctr = 0.0
        if stats and stats.impressions > 0:
            ctr = (stats.clicks / stats.impressions) * 100

        result.append(BannerDetailResponse(
            **_banner_fields(banner),
            stats={
                "impressions": stats.impressions if stats else 0,
                "clicks": stats.clicks if stats else 0,
                "ctr": ctr,
            },
        ))

    return result


@router.get("/banners/{banner_id}", response_model=BannerDetailResponse)
def get_homepage_banner(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_id: int,
) -> Any:
    """
    Get details of a specific homepage banner (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = db.get(HomepageBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    stats = db.exec(select(HomepageBannerStats).where(HomepageBannerStats.banner_id == banner.id)).first()
    ctr = 0.0
    if stats and stats.impressions > 0:
        ctr = (stats.clicks / stats.impressions) * 100

    return BannerDetailResponse(
        **_banner_fields(banner),
        stats={
            "impressions": stats.impressions if stats else 0,
            "clicks": stats.clicks if stats else 0,
            "ctr": ctr,
        },
    )


@router.patch("/banners/{banner_id}", response_model=BannerResponse)
def update_homepage_banner(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_id: int,
    banner_in: UpdateBannerRequest,
) -> Any:
    """
    Update a homepage banner (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = db.get(HomepageBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    # Only allow updates to draft or scheduled banners
    if banner.status == BannerStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Cannot update active banners")

    update_data = banner_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(banner, field, value)

    banner.updated_at = datetime.utcnow()
    db.add(banner)
    db.commit()
    db.refresh(banner)

    return BannerResponse(**_banner_fields(banner))


@router.post("/banners/{banner_id}/publish", response_model=dict)
def publish_banner(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_id: int,
) -> Any:
    """
    Publish a banner (change status to SCHEDULED or ACTIVE).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = db.get(HomepageBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    now = datetime.utcnow()

    # Determine status based on dates
    if now < banner.start_date:
        banner.status = BannerStatus.SCHEDULED
    elif now >= banner.start_date and now < banner.end_date:
        banner.status = BannerStatus.ACTIVE
    else:
        raise HTTPException(status_code=400, detail="Banner dates are invalid or already expired")

    banner.updated_at = datetime.utcnow()
    db.add(banner)
    db.commit()

    return {"status": "published", "banner_id": banner_id, "banner_status": banner.status}


@router.post("/banners/{banner_id}/pause", response_model=dict)
def pause_banner(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_id: int,
) -> Any:
    """
    Pause an active banner.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = db.get(HomepageBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    if banner.status != BannerStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only active banners can be paused")

    banner.status = BannerStatus.PAUSED
    banner.updated_at = datetime.utcnow()
    db.add(banner)
    db.commit()

    return {"status": "paused", "banner_id": banner_id}


@router.delete("/banners/{banner_id}", response_model=dict)
def delete_banner(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_id: int,
) -> Any:
    """
    Delete a banner (admin only, only draft/expired allowed).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = db.get(HomepageBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    if banner.status == BannerStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Cannot delete active banners")

    # Delete stats first, in its own flush — HomepageBanner and
    # HomepageBannerStats aren't linked via an ORM relationship(), just a
    # raw FK column, so SQLAlchemy's unit-of-work can't infer the delete
    # order automatically and may try the banner first, hitting the FK
    # constraint.
    stats = db.exec(select(HomepageBannerStats).where(HomepageBannerStats.banner_id == banner.id)).first()
    if stats:
        db.delete(stats)
        db.flush()

    db.delete(banner)
    db.commit()

    return {"message": "Banner deleted", "banner_id": banner_id}


@router.post("/banners/{banner_id}/reset-stats", response_model=dict)
def reset_banner_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    banner_id: int,
) -> Any:
    """
    Zero out a banner's impression/click counters (admin only).
    Useful for clearing out test traffic before a banner goes live for real.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    banner = db.get(HomepageBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    stats = db.exec(select(HomepageBannerStats).where(HomepageBannerStats.banner_id == banner.id)).first()
    if stats:
        stats.impressions = 0
        stats.clicks = 0
        stats.updated_at = datetime.utcnow()
        db.add(stats)
        db.commit()

    return {"message": "Stats reset", "banner_id": banner_id}


# ============================================================================
# Advertising Analytics Endpoints
# ============================================================================

@router.get("/stats", response_model=AdvertisingStatsResponse)
def get_advertising_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get advertising statistics and revenue metrics (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.utcnow()

    # Get all advertisements
    all_ads = db.exec(select(Advertisement)).all()
    active_ads = [a for a in all_ads if a.status == AdvertisementStatus.ACTIVE and a.end_date > now]
    expired_ads = [a for a in all_ads if a.status == AdvertisementStatus.EXPIRED or a.end_date <= now]

    # Calculate revenue by placement type
    by_placement = {}
    total_revenue = 0.0
    for ad in all_ads:
        if ad.status == AdvertisementStatus.ACTIVE:
            by_placement[ad.placement_type] = by_placement.get(ad.placement_type, 0) + ad.amount_paid
            total_revenue += ad.amount_paid

    avg_cost = total_revenue / max(len(all_ads), 1)

    return AdvertisingStatsResponse(
        total_campaigns=len(all_ads),
        active_campaigns=len(active_ads),
        expired_campaigns=len(expired_ads),
        total_revenue=total_revenue,
        avg_campaign_cost=avg_cost,
        by_placement_type=by_placement,
    )
