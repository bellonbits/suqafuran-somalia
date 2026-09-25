"""Service to sync shop listings to their primary category."""

import logging
from sqlmodel import Session, select
from app.models.user import User
from app.models.listing import Listing

logger = logging.getLogger(__name__)


def sync_shop_listings_to_primary_category(db: Session) -> dict:
    """
    Find all shops with a primary_category_id set.
    For each shop, move all their listings to the primary category.

    Returns: {"shops_updated": int, "listings_migrated": int, "errors": int}
    """
    stats = {"shops_updated": 0, "listings_migrated": 0, "errors": 0}

    try:
        # Get all users with a primary_category_id set
        shops_with_primary = db.exec(
            select(User).where(User.primary_category_id.isnot(None))
        ).all()

        for shop in shops_with_primary:
            if not shop.primary_category_id:
                continue

            try:
                # Find all this shop's listings NOT in their primary category
                misaligned_listings = db.exec(
                    select(Listing).where(
                        Listing.owner_id == shop.id,
                        Listing.category_id != shop.primary_category_id,
                        Listing.status.in_(["active", "pending"])
                    )
                ).all()

                if misaligned_listings:
                    for listing in misaligned_listings:
                        listing.category_id = shop.primary_category_id
                        db.add(listing)

                    db.commit()
                    stats["listings_migrated"] += len(misaligned_listings)
                    stats["shops_updated"] += 1
                    logger.info(f"Migrated {len(misaligned_listings)} listings for shop {shop.id} to category {shop.primary_category_id}")

            except Exception as e:
                logger.error(f"Error syncing listings for shop {shop.id}: {e}")
                stats["errors"] += 1
                db.rollback()
                continue

        logger.info(f"Shop listing sync complete: {stats}")
        return stats

    except Exception as e:
        logger.error(f"Critical error in shop listing sync: {e}")
        stats["errors"] += 1
        return stats


async def scheduled_shop_listing_sync(db: Session) -> None:
    """Background task to sync shop listings (runs periodically)."""
    try:
        sync_shop_listings_to_primary_category(db)
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")
