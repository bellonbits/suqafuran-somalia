"""
Featured advertising service for premium placements.
Handles featured product, featured shop, and homepage banner placements.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select
from app.models import FeaturedSelling, SellerBilling
from app.core.logging_config import get_logger

logger = get_logger("featured_advertising")


class FeaturedAdvertisingService:
    """Manages featured advertising campaigns with analytics and placement limits."""

    # Placement types with descriptions
    PLACEMENT_TYPES = {
        "homepage_featured_shop": {
            "name": "Homepage Featured Shop",
            "description": "Premium placement on homepage (max 5)",
            "daily_price": 500.0,
            "weekly_price": 2500.0,
            "monthly_price": 8000.0,
            "stars": 5,
        },
        "sponsored_product": {
            "name": "Sponsored Product",
            "description": "Featured in search results & category",
            "daily_price": 100.0,
            "weekly_price": 500.0,
            "monthly_price": 1500.0,
            "stars": 5,
        },
        "category_featured_shop": {
            "name": "Category Featured Shop",
            "description": "Featured in category listings (max 3)",
            "daily_price": 200.0,
            "weekly_price": 1000.0,
            "monthly_price": 3000.0,
            "stars": 4,
        },
        "search_sponsored": {
            "name": "Search Sponsored",
            "description": "Top of search results (max 2)",
            "daily_price": 150.0,
            "weekly_price": 750.0,
            "monthly_price": 2000.0,
            "stars": 5,
        },
        "featured_banner": {
            "name": "Featured Banner",
            "description": "Rotating homepage banner",
            "daily_price": 300.0,
            "weekly_price": 2000.0,
            "monthly_price": 6000.0,
            "stars": 4,
        },
        "new_arrival_promotion": {
            "name": "New Arrival Promotion",
            "description": "Highlight recent products",
            "daily_price": 100.0,
            "weekly_price": 500.0,
            "monthly_price": 1500.0,
            "stars": 4,
        },
        "flash_sale": {
            "name": "Flash Sale Promotion",
            "description": "Daily deal section",
            "daily_price": 200.0,
            "weekly_price": 1000.0,
            "monthly_price": 2500.0,
            "stars": 4,
        },
        "market_promotion": {
            "name": "Market Promotion",
            "description": "Featured by market (Eastleigh, etc)",
            "daily_price": 150.0,
            "weekly_price": 750.0,
            "monthly_price": 2000.0,
            "stars": 4,
        },
        "recommended_shops": {
            "name": "Recommended Shops",
            "description": "Appear in recommendations",
            "daily_price": 100.0,
            "weekly_price": 500.0,
            "monthly_price": 1500.0,
            "stars": 3,
        },
    }

    # Placement limits to maintain marketplace integrity
    PLACEMENT_LIMITS = {
        "homepage_featured_shop": 5,      # Max 5 shops on homepage
        "search_sponsored": 2,             # Max 2 sponsored in search
        "category_featured_shop": 3,       # Max 3 per category
        "featured_banner": 1,              # One rotating banner
    }

    # Duration options (in days) with pricing tiers
    DURATION_OPTIONS = {
        1: "24 hours",
        3: "3 days",
        7: "1 week",
        14: "2 weeks",
        30: "1 month",
    }

    def get_placement_price(
        self,
        placement_type: str,
        duration_days: int = 7
    ) -> float:
        """
        Calculate price for a placement based on type and duration.

        Args:
            placement_type: Type of placement
            duration_days: Duration in days (1, 3, 7, 14, or 30)

        Returns:
            Total price in KES
        """
        if placement_type not in self.PLACEMENT_TYPES:
            raise ValueError(f"Invalid placement type: {placement_type}")

        if duration_days not in self.DURATION_OPTIONS:
            raise ValueError(f"Invalid duration. Allowed: {list(self.DURATION_OPTIONS.keys())}")

        placement = self.PLACEMENT_TYPES[placement_type]

        # Select appropriate price based on duration
        if duration_days == 1:
            price = placement["daily_price"]
        elif duration_days in [3, 7]:
            # Use weekly price, prorated
            price = placement["weekly_price"] * (duration_days / 7)
        elif duration_days == 14:
            price = placement["weekly_price"] * 2
        elif duration_days == 30:
            price = placement["monthly_price"]

        return round(price, 2)

    def can_add_placement(
        self,
        placement_type: str,
        session: Optional[Session] = None
    ) -> bool:
        """
        Check if more placements of this type can be added.

        Returns False if limit is reached.
        """
        if placement_type not in self.PLACEMENT_LIMITS:
            return True  # No limit for this type

        limit = self.PLACEMENT_LIMITS[placement_type]

        # Count active placements of this type
        if session:
            count = session.exec(
                select(FeaturedSelling).where(
                    FeaturedSelling.placement_type == placement_type,
                    FeaturedSelling.is_active == True,
                    FeaturedSelling.ends_at > datetime.utcnow(),
                )
            ).all()

            return len(count) < limit

        return True

    def get_placement_remaining_capacity(
        self,
        placement_type: str,
        session: Optional[Session] = None
    ) -> Optional[int]:
        """Get remaining capacity for a placement type."""
        if placement_type not in self.PLACEMENT_LIMITS:
            return None

        limit = self.PLACEMENT_LIMITS[placement_type]

        if session:
            count = len(session.exec(
                select(FeaturedSelling).where(
                    FeaturedSelling.placement_type == placement_type,
                    FeaturedSelling.is_active == True,
                    FeaturedSelling.ends_at > datetime.utcnow(),
                )
            ).all())

            return max(0, limit - count)

        return limit

    def create_featured_placement(
        self,
        seller_id: int,
        placement_type: str,
        duration_days: int,
        category_id: Optional[int] = None,
        session: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Create a featured placement and initiate payment.

        placement_type: "featured_product", "featured_shop", "homepage_banner", "category_featured"
        """

        if placement_type not in self.PLACEMENT_TYPES:
            raise ValueError(f"Invalid placement type: {placement_type}")

        # Calculate price
        price_kes = self.get_placement_price(placement_type, duration_days)

        # Create placement record
        now = datetime.utcnow()
        ends_at = now + timedelta(days=duration_days)

        featured = FeaturedSelling(
            seller_id=seller_id,
            placement_type=placement_type,
            category_id=category_id if placement_type == "category_featured" else None,
            starts_at=now,
            ends_at=ends_at,
            price_kes=price_kes,
            is_paid=False,
            is_active=False,
        )

        session.add(featured)
        session.commit()
        session.refresh(featured)

        logger.info(
            f"Created featured placement {featured.id}: {placement_type} for seller {seller_id}"
        )

        return {
            "placement_id": featured.id,
            "placement_type": placement_type,
            "duration_days": duration_days,
            "price_kes": price_kes,
            "starts_at": featured.starts_at,
            "ends_at": featured.ends_at,
            "message": f"Featured placement created. Total: KSh {price_kes}",
        }

    def activate_featured_placement(
        self,
        placement_id: int,
        billing_id: int,
        session: Session,
    ) -> bool:
        """Activate a featured placement after payment."""

        placement = session.exec(
            select(FeaturedSelling).where(FeaturedSelling.id == placement_id)
        ).first()

        if not placement:
            logger.error(f"Placement {placement_id} not found")
            return False

        placement.is_paid = True
        placement.is_active = True
        placement.billing_id = billing_id

        session.add(placement)
        session.commit()

        logger.info(f"Activated featured placement {placement_id}")
        return True

    def get_active_placements(
        self,
        placement_type: str,
        category_id: Optional[int] = None,
        limit: int = 10,
        session: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """Get active featured placements by type."""

        query = select(FeaturedSelling).where(
            FeaturedSelling.placement_type == placement_type,
            FeaturedSelling.is_active == True,
            FeaturedSelling.ends_at > datetime.utcnow(),
        )

        if category_id and placement_type == "category_featured":
            query = query.where(FeaturedSelling.category_id == category_id)

        query = query.limit(limit)
        placements = session.exec(query).all()

        return [
            {
                "id": p.id,
                "seller_id": p.seller_id,
                "placement_type": p.placement_type,
                "starts_at": p.starts_at,
                "ends_at": p.ends_at,
                "days_remaining": (p.ends_at - datetime.utcnow()).days,
            }
            for p in placements
        ]

    def get_seller_placements(
        self,
        seller_id: int,
        session: Session,
    ) -> List[Dict[str, Any]]:
        """Get all placements for a seller (active and inactive)."""

        placements = session.exec(
            select(FeaturedSelling).where(FeaturedSelling.seller_id == seller_id)
        ).all()

        return [
            {
                "id": p.id,
                "placement_type": p.placement_type,
                "is_active": p.is_active,
                "is_paid": p.is_paid,
                "starts_at": p.starts_at,
                "ends_at": p.ends_at,
                "price_kes": p.price_kes,
                "days_remaining": max(0, (p.ends_at - datetime.utcnow()).days)
                if p.is_active
                else 0,
            }
            for p in placements
        ]

    def cancel_featured_placement(
        self,
        placement_id: int,
        seller_id: int,
        session: Session,
    ) -> bool:
        """Cancel a featured placement (refund if not started)."""

        placement = session.exec(
            select(FeaturedSelling).where(
                FeaturedSelling.id == placement_id,
                FeaturedSelling.seller_id == seller_id,
            )
        ).first()

        if not placement:
            logger.error(f"Placement {placement_id} not found or not owned by seller {seller_id}")
            return False

        # Only allow cancellation if not started or within 24 hours
        time_until_start = (placement.starts_at - datetime.utcnow()).total_seconds() / 3600
        if time_until_start > -24:
            placement.is_active = False
            session.add(placement)
            session.commit()
            logger.info(f"Cancelled featured placement {placement_id}")
            return True

        return False

    def has_active_featured_product(
        self,
        listing_id: int,
        session: Session,
    ) -> bool:
        """Check if a product/listing has an active featured product placement."""
        placement = session.exec(
            select(FeaturedSelling).where(
                FeaturedSelling.listing_id == listing_id,
                FeaturedSelling.placement_type == "featured_product",
                FeaturedSelling.is_active == True,
                FeaturedSelling.ends_at > datetime.utcnow(),
            )
        ).first()
        return placement is not None

    def has_active_featured_shop(
        self,
        seller_id: int,
        session: Session,
    ) -> bool:
        """Check if a seller/shop has an active featured shop placement."""
        placement = session.exec(
            select(FeaturedSelling).where(
                FeaturedSelling.seller_id == seller_id,
                FeaturedSelling.placement_type == "featured_shop",
                FeaturedSelling.is_active == True,
                FeaturedSelling.ends_at > datetime.utcnow(),
            )
        ).first()
        return placement is not None

    def get_all_featured_listing_ids(
        self,
        placement_type: str = "featured_product",
        session: Optional[Session] = None,
    ) -> set:
        """Get all listing IDs with active featured placements."""
        placements = session.exec(
            select(FeaturedSelling).where(
                FeaturedSelling.placement_type == placement_type,
                FeaturedSelling.is_active == True,
                FeaturedSelling.ends_at > datetime.utcnow(),
            )
        ).all()
        return {p.listing_id for p in placements if p.listing_id}

    def get_campaign_analytics(
        self,
        placement_id: int,
        session: Session,
    ) -> Optional[Dict[str, Any]]:
        """Get performance analytics for a campaign."""
        placement = session.exec(
            select(FeaturedSelling).where(FeaturedSelling.id == placement_id)
        ).first()

        if not placement:
            return None

        # Calculate cost per engagement
        total_engagement = (
            placement.shop_visits +
            placement.product_clicks +
            placement.whatsapp_clicks +
            placement.call_clicks +
            placement.message_clicks
        )

        return {
            "campaign_id": placement.id,
            "campaign_name": placement.campaign_name,
            "placement_type": placement.placement_type,
            "duration": f"{(placement.ends_at - placement.starts_at).days} days",
            "views": placement.views,
            "shop_visits": placement.shop_visits,
            "product_clicks": placement.product_clicks,
            "whatsapp_clicks": placement.whatsapp_clicks,
            "call_clicks": placement.call_clicks,
            "message_clicks": placement.message_clicks,
            "followers_gained": placement.followers_gained,
            "conversions": placement.conversions,
            "total_engagement": total_engagement,
            "price_kes": placement.price_kes,
            "cost_per_view": round(placement.price_kes / max(placement.views, 1), 2),
            "cost_per_engagement": round(placement.price_kes / max(total_engagement, 1), 2),
            "is_active": placement.is_active,
            "status": "Active" if placement.is_active and placement.ends_at > datetime.utcnow() else "Expired",
        }

    def get_seller_campaign_analytics(
        self,
        seller_id: int,
        session: Session,
    ) -> List[Dict[str, Any]]:
        """Get analytics for all campaigns by a seller."""
        placements = session.exec(
            select(FeaturedSelling).where(
                FeaturedSelling.seller_id == seller_id
            ).order_by(FeaturedSelling.created_at.desc())
        ).all()

        return [self.get_campaign_analytics(p.id, session) for p in placements]

    def track_view(
        self,
        placement_id: int,
        session: Session,
    ) -> None:
        """Track a view of a featured placement."""
        placement = session.exec(
            select(FeaturedSelling).where(FeaturedSelling.id == placement_id)
        ).first()

        if placement:
            placement.views += 1
            placement.updated_at = datetime.utcnow()
            session.add(placement)
            session.commit()

    def track_click(
        self,
        placement_id: int,
        click_type: str,  # "shop_visit", "product_click", "whatsapp", "call", "message"
        session: Session,
    ) -> None:
        """Track a click/engagement on a featured placement."""
        placement = session.exec(
            select(FeaturedSelling).where(FeaturedSelling.id == placement_id)
        ).first()

        if placement:
            if click_type == "shop_visit":
                placement.shop_visits += 1
            elif click_type == "product_click":
                placement.product_clicks += 1
            elif click_type == "whatsapp":
                placement.whatsapp_clicks += 1
            elif click_type == "call":
                placement.call_clicks += 1
            elif click_type == "message":
                placement.message_clicks += 1

            placement.updated_at = datetime.utcnow()
            session.add(placement)
            session.commit()


# Singleton instance
featured_advertising_service = FeaturedAdvertisingService()
