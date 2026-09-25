"""Service for managing shop primary categories based on listing distribution."""

from typing import Optional
from sqlmodel import Session, select, func
from app.models.user import User
from app.models.listing import Listing


def calculate_primary_category(db: Session, user_id: int) -> Optional[int]:
    """
    Calculate the primary category for a shop based on the number of active listings
    in each category. Returns the category_id with the most listings, or None if
    the user has no active listings.

    Args:
        db: Database session
        user_id: User/shop ID

    Returns:
        Primary category_id or None
    """
    # Get count of active approved listings per category for this user
    result = db.exec(
        select(
            Listing.category_id,
            func.count(Listing.id).label('count')
        )
        .where(
            Listing.owner_id == user_id,
            Listing.status == 'active',
            Listing.moderation_status == 'approved'
        )
        .group_by(Listing.category_id)
        .order_by(func.count(Listing.id).desc())
        .limit(1)
    ).first()

    if result:
        return result[0]
    return None


def update_shop_primary_category(db: Session, user_id: int) -> bool:
    """
    Update a shop's primary category based on their current listings.

    Args:
        db: Database session
        user_id: User/shop ID

    Returns:
        True if updated, False if no changes needed
    """
    user = db.get(User, user_id)
    if not user:
        return False

    primary_category_id = calculate_primary_category(db, user_id)

    if user.primary_category_id != primary_category_id:
        user.primary_category_id = primary_category_id
        db.add(user)
        db.commit()
        return True

    return False


def backfill_primary_categories(db: Session, limit: Optional[int] = None) -> int:
    """
    Backfill primary categories for all shops with active listings.
    Used for data migration.

    Args:
        db: Database session
        limit: Maximum number of shops to update (None = all)

    Returns:
        Number of shops updated
    """
    # Get all users with active approved listings
    query = select(User).where(
        User.id.in_(
            select(Listing.owner_id)
            .where(
                Listing.status == 'active',
                Listing.moderation_status == 'approved'
            )
            .distinct()
        )
    )

    if limit:
        query = query.limit(limit)

    users = db.exec(query).all()

    updated = 0
    for user in users:
        if update_shop_primary_category(db, user.id):
            updated += 1

    return updated
