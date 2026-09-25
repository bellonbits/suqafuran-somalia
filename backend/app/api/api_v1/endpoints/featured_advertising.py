"""
Featured advertising endpoints.
Handles featured product, featured shop, and homepage banner placements.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional

from app.db.session import get_db
from app.services.featured_advertising_service import featured_advertising_service
from app.services.subscription_service import subscription_service
from app.api.deps import get_current_user
from app.core.logging_config import get_logger
from app.models.advertising import Advertisement, AdvertisementStatus

logger = get_logger("featured_advertising_api")

router = APIRouter(tags=["featured-advertising"])


@router.get("/featured/pricing")
async def get_featured_pricing():
    """Get pricing for all featured placement types."""
    return {
        "placement_types": featured_advertising_service.PLACEMENT_TYPES,
        "summary": {
            "sponsored_product": {
                "daily": 100.0,
                "weekly": 500.0,
                "monthly": 1500.0,
                "description": "Featured in search results & category",
            },
            "homepage_featured_shop": {
                "daily": 500.0,
                "weekly": 2500.0,
                "monthly": 8000.0,
                "description": "Premium placement on homepage",
            },
            "category_featured_shop": {
                "daily": 200.0,
                "weekly": 1000.0,
                "monthly": 3000.0,
                "description": "Featured in category listings",
            },
            "featured_banner": {
                "daily": 300.0,
                "weekly": 2000.0,
                "monthly": 6000.0,
                "description": "Rotating homepage banner",
            },
        },
    }


@router.post("/featured/sellers/{seller_id}/purchase")
async def purchase_featured_placement(
    seller_id: int,
    payload: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Purchase a featured placement.
    payload: {
        "placement_type": "featured_product|featured_shop|homepage_banner|category_featured",
        "duration_days": 1-365,
        "category_id": optional (for category_featured)
    }
    """

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    placement_type = payload.get("placement_type")
    duration_days = payload.get("duration_days", 7)
    category_id = payload.get("category_id")

    if placement_type not in featured_advertising_service.PLACEMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid placement type",
        )

    if duration_days < 1 or duration_days > 365:
        raise HTTPException(
            status_code=400,
            detail="Duration must be between 1 and 365 days",
        )

    try:
        result = featured_advertising_service.create_featured_placement(
            seller_id=seller_id,
            placement_type=placement_type,
            duration_days=duration_days,
            category_id=category_id,
            session=session,
        )

        logger.info(f"Featured placement created for seller {seller_id}")

        return {
            "status": "success",
            "placement_id": result["placement_id"],
            "placement_type": placement_type,
            "duration_days": duration_days,
            "price_kes": result["price_kes"],
            "message": f"Placement created. Total: KSh {result['price_kes']}",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create featured placement: {e}")
        raise HTTPException(status_code=500, detail="Failed to create placement")


@router.get("/featured/sellers/{seller_id}/placements")
async def get_seller_featured_placements(
    seller_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get all featured placements for a seller."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    placements = featured_advertising_service.get_seller_placements(seller_id, session)

    return {
        "seller_id": seller_id,
        "placements": placements,
        "total_active": sum(1 for p in placements if p["is_active"]),
    }


@router.get("/featured/placements/{placement_type}")
async def get_active_featured_placements(
    placement_type: str,
    category_id: Optional[int] = None,
    limit: int = 10,
    session: Session = Depends(get_db),
):
    """Get active featured placements by type (public endpoint)."""

    if placement_type not in featured_advertising_service.PLACEMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid placement type",
        )

    placements = featured_advertising_service.get_active_placements(
        placement_type=placement_type,
        category_id=category_id,
        limit=limit,
        session=session,
    )

    return {
        "placement_type": placement_type,
        "placements": placements,
        "total_active": len(placements),
    }


@router.post("/featured/sellers/{seller_id}/placements/{placement_id}/cancel")
async def cancel_featured_placement(
    seller_id: int,
    placement_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Cancel a featured placement (with refund if not started)."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    success = featured_advertising_service.cancel_featured_placement(
        placement_id=placement_id,
        seller_id=seller_id,
        session=session,
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel this placement (already started)",
        )

    logger.info(f"Cancelled featured placement {placement_id}")

    return {
        "status": "cancelled",
        "placement_id": placement_id,
        "message": "Featured placement cancelled",
    }


# ADMIN ENDPOINTS
@router.get("/admin/featured/stats")
async def get_featured_advertising_stats(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get featured advertising metrics for admin dashboard."""
    from datetime import datetime

    # Verify admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    # Get all placements
    all_placements = session.exec(select(Advertisement)).all()
    active_placements = [p for p in all_placements if p.status == AdvertisementStatus.ACTIVE and p.end_date > datetime.utcnow()]

    # Calculate revenue by type
    by_type = {}
    by_type_revenue = {}
    for ptype in ["featured_product", "featured_shop", "homepage_banner", "category_featured"]:
        placements_of_type = [p for p in all_placements if p.placement_type == ptype]
        by_type[ptype] = len(placements_of_type)
        by_type_revenue[ptype] = sum(p.amount or 0 for p in placements_of_type if p.status == AdvertisementStatus.ACTIVE)

    total_revenue = sum(by_type_revenue.values())

    return {
        "total_placements": len(all_placements),
        "active_placements": len(active_placements),
        "total_revenue": total_revenue,
        "avg_placement_cost": total_revenue / max(len(all_placements), 1),
        "by_type": by_type,
        "by_type_revenue": by_type_revenue,
    }


@router.get("/admin/featured/placements")
async def list_featured_placements(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get list of active featured placements for admin."""
    from datetime import datetime

    # Verify admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    placements = session.exec(
        select(Advertisement).where(
            Advertisement.status == AdvertisementStatus.ACTIVE,
            Advertisement.end_date > datetime.utcnow(),
        )
    ).all()

    return {
        "placements": [
            {
                "seller_id": p.seller_id,
                "placement_type": p.placement_type,
                "days_remaining": max(0, (p.end_date - datetime.utcnow()).days),
                "amount": p.amount or 0,
                "start_date": p.start_date,
                "end_date": p.end_date,
            }
            for p in placements
        ]
    }
