"""Diagnostic endpoints for analyzing database state."""

from typing import Any
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.api import deps
from app.models.user import User

router = APIRouter(prefix="/admin/diagnostics", tags=["admin-diagnostics"])


@router.get("/shop-locations")
def get_shop_locations(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> dict:
    """Get analysis of shop locations in database (admin only)."""
    if not current_user or not current_user.is_admin:
        return {"error": "Admin access required"}

    try:
        # Get shops with locations
        query = select(User).where(
            User.business_name.isnot(None),
            User.location.isnot(None),
        )
        shops_with_location = db.exec(query).all()

        # Get shops without locations
        query_without = select(User).where(
            User.business_name.isnot(None),
            User.location.is_(None),
        )
        shops_without_location = db.exec(query_without).all()

        # Group by location
        location_counts = {}
        for shop in shops_with_location:
            loc = shop.location.strip().lower()
            if loc not in location_counts:
                location_counts[loc] = {"count": 0, "shops": []}
            location_counts[loc]["count"] += 1
            if len(location_counts[loc]["shops"]) < 3:  # Store first 3 samples
                location_counts[loc]["shops"].append({
                    "id": shop.id,
                    "name": shop.business_name,
                })

        # Sort by frequency
        sorted_locations = sorted(
            location_counts.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )

        return {
            "total_shops": len(shops_with_location) + len(shops_without_location),
            "shops_with_location": len(shops_with_location),
            "shops_without_location": len(shops_without_location),
            "location_distribution": [
                {
                    "location": loc,
                    "count": data["count"],
                    "percentage": round((data["count"] / len(shops_with_location) * 100), 1) if shops_with_location else 0,
                    "samples": data["shops"],
                }
                for loc, data in sorted_locations
            ],
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/markets-status")
def get_markets_status(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> dict:
    """Get status of market field population (admin only)."""
    if not current_user or not current_user.is_admin:
        return {"error": "Admin access required"}

    try:
        # Count shops by market
        query_all = select(User).where(User.business_name.isnot(None))
        all_shops = db.exec(query_all).all()

        market_counts = {}
        for shop in all_shops:
            market = shop.market or "Not Set"
            market_counts[market] = market_counts.get(market, 0) + 1

        # Sort by frequency
        sorted_markets = sorted(market_counts.items(), key=lambda x: x[1], reverse=True)

        return {
            "total_shops": len(all_shops),
            "markets_set": len([m for m in all_shops if m.market]),
            "markets_empty": len([m for m in all_shops if not m.market]),
            "distribution": [
                {
                    "market": market,
                    "count": count,
                    "percentage": round((count / len(all_shops) * 100), 1),
                }
                for market, count in sorted_markets
            ],
        }
    except Exception as e:
        return {"error": str(e)}
