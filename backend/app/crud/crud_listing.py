from typing import List, Optional
from sqlmodel import Session, select, func
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from app.models.listing import Listing, ListingBase, Category, SubSubCategory
from app.models.subcategory import Subcategory


def get_listing(db: Session, id: int) -> Optional[Listing]:
    return db.exec(select(Listing).where(Listing.id == id).options(selectinload(Listing.owner))).first()


def get_listings(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[int] = None,
    owner_id: Optional[int] = None,
    search: Optional[str] = None,
    location: Optional[str] = None,
    attributes: Optional[dict] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    status: Optional[str] = None,
) -> List[Listing]:
    from app.models.user import User
    statement = (
        select(Listing)
        .join(User, Listing.owner_id == User.id)
        .where(User.is_suspended == False) # Security: Hide listings from suspended scammers
        .order_by(
            Listing.boost_level.desc(), 
            User.trust_score.desc(), # Primary anti-scam signal for ranking
            Listing.created_at.desc(),
            User.is_verified.desc()
        )
        .offset(skip)
        .limit(limit)
        .options(selectinload(Listing.owner))
    )
    if category_id:
        statement = statement.where(Listing.category_id == category_id)
    if owner_id:
        statement = statement.where(Listing.owner_id == owner_id)
    if search:
        search_filter = f"%{search}%"
        # Full-text match over title/description PLUS the listing's own
        # category/subcategory/subsubcategory names, with English stemming --
        # this is what makes a generic term like "shoes" or "clothes" match
        # items filed under Shoes/Clothing even when the listing's own text
        # never uses that exact word ("clothes" and "Clothing" share a stem).
        # Somali fields keep plain substring matching since English stemming
        # doesn't apply to Somali text.
        statement = (
            statement
            .join(Category, Listing.category_id == Category.id, isouter=True)
            .join(Subcategory, Listing.subcategory_id == Subcategory.id, isouter=True)
            .join(SubSubCategory, Listing.subsubcategory_id == SubSubCategory.id, isouter=True)
            .where(
                or_(
                    func.to_tsvector(
                        'english',
                        func.coalesce(Listing.title_en, '') + ' ' +
                        func.coalesce(Listing.description_en, '') + ' ' +
                        func.coalesce(Category.name_en, '') + ' ' +
                        func.coalesce(Subcategory.name_en, '') + ' ' +
                        func.coalesce(SubSubCategory.name_en, '')
                    ).op('@@')(func.plainto_tsquery('english', search)),
                    Listing.title_so.ilike(search_filter),
                    Listing.description_so.ilike(search_filter),
                )
            )
        )
    if location:
        statement = statement.where(Listing.location.ilike(f"%{location}%"))
    if min_price is not None:
        statement = statement.where(Listing.price >= min_price)
    if max_price is not None:
        statement = statement.where(Listing.price <= max_price)
    if status is not None:
        statement = statement.where(Listing.status == status)
    else:
        statement = statement.where(Listing.status != "deleted")

    if attributes:
        attrs_copy = dict(attributes)
        # Handle subcategory and subsubcategory filters by name → IDs
        subcategory_name = attrs_copy.pop("subcategory", None)
        subsubcategory_name = attrs_copy.pop("subsubcategory", None)
        
        if subcategory_name and category_id:
            sc = db.exec(
                select(Subcategory).where(
                    Subcategory.category_id == category_id,
                    (Subcategory.name_en == subcategory_name) | (Subcategory.name_so == subcategory_name),
                )
            ).first()
            if sc:
                statement = statement.where(Listing.subcategory_id == sc.id)
                
                # If we also have a subsubcategory name, filter by it under the found subcategory
                if subsubcategory_name:
                    ssc = db.exec(
                        select(SubSubCategory).where(
                            SubSubCategory.subcategory_id == sc.id,
                            (SubSubCategory.name_en == subsubcategory_name) | (SubSubCategory.name_so == subsubcategory_name),
                        )
                    ).first()
                    if ssc:
                        statement = statement.where(Listing.subsubcategory_id == ssc.id)
        
        for key, value in attrs_copy.items():
            statement = statement.where(func.json_extract_path_text(Listing.attributes, key) == str(value))
    
    return db.exec(statement).all()


def create_listing(
    db: Session, *, listing_in: ListingBase, owner_id: int
) -> Listing:
    db_obj = Listing.model_validate(
        listing_in, update={"owner_id": owner_id}
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update_listing(
    db: Session, *, db_obj: Listing, listing_in: ListingBase
) -> Listing:
    update_data = listing_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def remove_listing(db: Session, *, id: int) -> Listing:
    obj = db.get(Listing, id)
    if obj:
        obj.status = "deleted"
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def get_categories(db: Session) -> List[Category]:
    return db.exec(select(Category)).all()


def get_category_by_slug(db: Session, slug: str) -> Optional[Category]:
    return db.exec(select(Category).where(Category.slug == slug)).first()


def create_category(db: Session, *, category_in: Category) -> Category:
    db.add(category_in)
    db.commit()
    db.refresh(category_in)
    return category_in


def remove_category(db: Session, *, id: int) -> Category:
    obj = db.get(Category, id)
    db.delete(obj)
    db.commit()
    return obj


def get_subcategories(db: Session, *, category_id: Optional[int] = None) -> List[Subcategory]:
    statement = select(Subcategory)
    if category_id:
        statement = statement.where(Subcategory.category_id == category_id)
    return db.exec(statement).all()


def get_subcategory_by_slug(db: Session, slug: str) -> Optional[Subcategory]:
    return db.exec(select(Subcategory).where(Subcategory.slug == slug)).first()


def create_subcategory(db: Session, *, subcategory_in: any) -> any:
    db.add(subcategory_in)
    db.commit()
    db.refresh(subcategory_in)
    return subcategory_in


def update_subcategory(db: Session, *, db_obj: any, subcategory_in: dict) -> any:
    for field, value in subcategory_in.items():
        if hasattr(db_obj, field):
            setattr(db_obj, field, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def remove_subcategory(db: Session, *, id: int) -> any:
    obj = db.get(Subcategory, id)
    db.delete(obj)
    db.commit()
    return obj


def approve_listing(
    db: Session, *, listing: Listing, approved_by_user_id: int, notes: Optional[str] = None
) -> Listing:
    """Approve a listing for publication."""
    from datetime import datetime as dt
    listing.approval_status = "approved"
    listing.approved_by_user_id = approved_by_user_id
    listing.status = "active"
    listing.moderation_status = "approved"
    listing.moderated_at = dt.utcnow()
    listing.moderator_id = approved_by_user_id
    if notes:
        listing.moderation_notes = notes
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def reject_listing(
    db: Session, *, listing: Listing, reason: str, rejected_by_user_id: int, notes: Optional[str] = None
) -> Listing:
    """Reject a listing with a reason."""
    from datetime import datetime as dt
    listing.approval_status = "rejected"
    listing.rejection_reason = reason
    listing.rejected_at = dt.utcnow()
    listing.status = "deleted"
    listing.moderation_status = "rejected"
    listing.moderated_at = dt.utcnow()
    listing.moderator_id = rejected_by_user_id
    if notes:
        listing.moderation_notes = notes
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def get_listings_by_approval_status(
    db: Session,
    *,
    approval_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Listing]:
    """Get listings filtered by approval status."""
    statement = select(Listing).order_by(
        Listing.created_at.desc()
    ).offset(skip).limit(limit)

    if approval_status:
        statement = statement.where(Listing.approval_status == approval_status)

    return db.exec(statement).all()
