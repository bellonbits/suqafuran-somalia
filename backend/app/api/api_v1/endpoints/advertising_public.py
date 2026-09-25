"""Public endpoints for advertising display and analytics tracking."""

from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.advertising import (
    HomepageBanner,
    HomepageBannerStats,
    Advertisement,
    AdvertisementStatus,
    BannerStatus,
)
from pydantic import BaseModel

router = APIRouter(prefix="/advertising", tags=["advertising-public"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class BannerDisplayResponse(BaseModel):
    id: int
    seller_id: int
    title: str
    subtitle: str | None
    image_url: str
    mobile_image_url: str | None
    button_text: str
    button_link: str
    priority: int


class FeaturedCheckResponse(BaseModel):
    is_featured: bool
    placement_type: str | None
    days_remaining: int | None


# ============================================================================
# Public Display Endpoints
# ============================================================================

@router.get("/active-banners", response_model=List[BannerDisplayResponse])
def get_active_banners(
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get active homepage banners for rotation (public endpoint).
    Returns banners sorted by priority.
    """
    now = datetime.utcnow()

    query = (
        select(HomepageBanner)
        .where(
            HomepageBanner.status == BannerStatus.ACTIVE,
            HomepageBanner.start_date <= now,
            HomepageBanner.end_date > now,
        )
        .order_by(HomepageBanner.priority.desc())
    )

    banners = db.exec(query).all()
    return [
        BannerDisplayResponse(
            id=banner.id,
            seller_id=banner.seller_id,
            title=banner.title or "Promotion",
            subtitle=banner.subtitle,
            image_url=banner.image_url or "",
            mobile_image_url=banner.mobile_image_url,
            button_text=banner.button_text or "Shop Now",
            button_link=banner.button_link or "/shops",
            priority=banner.priority or 0,
        )
        for banner in banners
    ]


@router.get("/listing/{listing_id}/is-featured", response_model=FeaturedCheckResponse)
def check_listing_featured(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
) -> Any:
    """
    Check if a listing has an active featured advertisement.
    """
    now = datetime.utcnow()

    ad = db.exec(
        select(Advertisement)
        .where(
            Advertisement.listing_id == listing_id,
            Advertisement.status == AdvertisementStatus.ACTIVE,
            Advertisement.end_date > now,
        )
    ).first()

    if not ad:
        return FeaturedCheckResponse(
            is_featured=False,
            placement_type=None,
            days_remaining=None,
        )

    days_remaining = max(0, (ad.end_date - now).days)

    return FeaturedCheckResponse(
        is_featured=True,
        placement_type=ad.placement_type,
        days_remaining=days_remaining,
    )


class BatchFeaturedCheckRequest(BaseModel):
    listing_ids: List[int]


@router.post("/listings/featured-status", response_model=dict[int, bool])
def check_listings_featured_batch(
    *,
    db: Session = Depends(deps.get_db),
    body: BatchFeaturedCheckRequest,
) -> Any:
    """
    Batch version of /listing/{id}/is-featured -- one query for however many
    listing ids a page needs, instead of one request (and one DB connection)
    per rendered product card. A page with 30 cards used to open 30 pooled
    connections at once here alone, which was enough to exhaust the pool.
    """
    if not body.listing_ids:
        return {}

    now = datetime.utcnow()
    unique_ids = list(set(body.listing_ids))

    featured_ids = set(
        db.exec(
            select(Advertisement.listing_id).where(
                Advertisement.listing_id.in_(unique_ids),
                Advertisement.status == AdvertisementStatus.ACTIVE,
                Advertisement.end_date > now,
            )
        ).all()
    )

    return {listing_id: listing_id in featured_ids for listing_id in unique_ids}


@router.get("/seller/{seller_id}/is-featured-shop", response_model=FeaturedCheckResponse)
def check_shop_featured(
    *,
    db: Session = Depends(deps.get_db),
    seller_id: int,
) -> Any:
    """
    Check if a seller's shop has an active featured shop advertisement.
    """
    now = datetime.utcnow()

    from app.models.advertising import PlacementType

    ad = db.exec(
        select(Advertisement)
        .where(
            Advertisement.seller_id == seller_id,
            Advertisement.placement_type == PlacementType.FEATURED_SHOP,
            Advertisement.status == AdvertisementStatus.ACTIVE,
            Advertisement.end_date > now,
        )
    ).first()

    if not ad:
        return FeaturedCheckResponse(
            is_featured=False,
            placement_type=None,
            days_remaining=None,
        )

    days_remaining = max(0, (ad.end_date - now).days)

    return FeaturedCheckResponse(
        is_featured=True,
        placement_type=PlacementType.FEATURED_SHOP,
        days_remaining=days_remaining,
    )


# ============================================================================
# Analytics Tracking Endpoints
# ============================================================================

@router.post("/banners/{banner_id}/impression")
def track_banner_impression(
    *,
    db: Session = Depends(deps.get_db),
    banner_id: int,
) -> Any:
    """
    Track an impression for a homepage banner.
    Called when the banner is displayed on the homepage.
    """
    stats = db.exec(
        select(HomepageBannerStats).where(HomepageBannerStats.banner_id == banner_id)
    ).first()

    if not stats:
        # Create stats record if it doesn't exist
        banner = db.get(HomepageBanner, banner_id)
        if not banner:
            raise HTTPException(status_code=404, detail="Banner not found")

        stats = HomepageBannerStats(banner_id=banner_id, impressions=1)
        db.add(stats)
    else:
        stats.impressions += 1
        stats.updated_at = datetime.utcnow()

    db.commit()
    return {"success": True, "impressions": stats.impressions}


@router.post("/banners/{banner_id}/click")
def track_banner_click(
    *,
    db: Session = Depends(deps.get_db),
    banner_id: int,
) -> Any:
    """
    Track a click for a homepage banner.
    Called when user clicks the banner's CTA button.
    """
    stats = db.exec(
        select(HomepageBannerStats).where(HomepageBannerStats.banner_id == banner_id)
    ).first()

    if not stats:
        # Create stats record if it doesn't exist
        banner = db.get(HomepageBanner, banner_id)
        if not banner:
            raise HTTPException(status_code=404, detail="Banner not found")

        stats = HomepageBannerStats(banner_id=banner_id, clicks=1)
        db.add(stats)
    else:
        stats.clicks += 1
        stats.updated_at = datetime.utcnow()

    db.commit()
    return {"success": True, "clicks": stats.clicks}


@router.post("/listings/{listing_id}/impression")
def track_listing_impression(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
) -> Any:
    """
    Track an impression for a featured product advertisement.
    """
    from app.models.advertising import Advertisement

    now = datetime.utcnow()

    ad = db.exec(
        select(Advertisement)
        .where(
            Advertisement.listing_id == listing_id,
            Advertisement.status == AdvertisementStatus.ACTIVE,
            Advertisement.end_date > now,
        )
    ).first()

    if not ad:
        return {"success": False, "message": "No active advertisement for this listing"}

    stats = db.exec(
        select(AdvertisementStats).where(AdvertisementStats.advertisement_id == ad.id)
    ).first()

    if stats:
        stats.impressions += 1
        stats.updated_at = datetime.utcnow()
        db.add(stats)
        db.commit()

    return {"success": True}


@router.post("/listings/{listing_id}/click")
def track_listing_click(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
) -> Any:
    """
    Track a click for a featured product advertisement.
    """
    from app.models.advertising import Advertisement

    now = datetime.utcnow()

    ad = db.exec(
        select(Advertisement)
        .where(
            Advertisement.listing_id == listing_id,
            Advertisement.status == AdvertisementStatus.ACTIVE,
            Advertisement.end_date > now,
        )
    ).first()

    if not ad:
        return {"success": False, "message": "No active advertisement for this listing"}

    stats = db.exec(
        select(AdvertisementStats).where(AdvertisementStats.advertisement_id == ad.id)
    ).first()

    if stats:
        stats.clicks += 1
        stats.updated_at = datetime.utcnow()
        db.add(stats)
        db.commit()

    return {"success": True}
