from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.api import deps
from app.models.listing import Listing
from app.models.listing_attribute import ListingAttribute
from app.models.attribute import Attribute
from app.models.subscription import FeaturedSelling

router = APIRouter()


@router.get("/listings/search", response_model=List[Any])
def search_listings(
    *,
    db: Session = Depends(deps.get_db),
    q: Optional[str] = Query(None, description="Search query"),
    category_id: Optional[int] = Query(None),
    subcategory_id: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    attributes: Optional[str] = Query(None, description="JSON string of attribute filters"),
    featured_only: bool = Query(False, description="Show only featured products"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """
    Advanced search with full-text search, category filtering, and attribute filtering.
    Supports featured product filtering.

    Example attribute filter:
    {"brand": ["nike", "adidas"], "condition": ["new", "like-new"], "price_range": [100, 500]}
    """
    statement = select(Listing).where(Listing.status == "active")

    # Text search
    if q:
        search_filter = f"%{q}%"
        statement = statement.where(
            (Listing.title_en.ilike(search_filter))
            | (Listing.title_so.ilike(search_filter))
            | (Listing.description_en.ilike(search_filter))
            | (Listing.description_so.ilike(search_filter))
        )

    # Category filter
    if category_id:
        statement = statement.where(Listing.category_id == category_id)

    if subcategory_id:
        statement = statement.where(Listing.subcategory_id == subcategory_id)

    # Price filter
    if min_price is not None:
        statement = statement.where(Listing.price >= min_price)
    if max_price is not None:
        statement = statement.where(Listing.price <= max_price)

    # Attribute filters
    if attributes:
        import json
        try:
            attr_filters = json.loads(attributes)
            for attr_slug, values in attr_filters.items():
                if not isinstance(values, list):
                    values = [values]

                # Join with ListingAttribute and Attribute tables
                subquery = select(ListingAttribute.listing_id).join(
                    Attribute, ListingAttribute.attribute_id == Attribute.id
                ).where(
                    (Attribute.slug == attr_slug)
                    & (ListingAttribute.value.in_(values))
                )
                statement = statement.where(Listing.id.in_(subquery))
        except json.JSONDecodeError:
            pass

    # Featured filter
    if featured_only:
        featured_ids = set()
        featured_placements = db.exec(
            select(FeaturedSelling).where(
                FeaturedSelling.placement_type == "featured_product",
                FeaturedSelling.is_active == True,
                FeaturedSelling.ends_at > datetime.utcnow(),
            )
        ).all()
        featured_ids = {p.listing_id for p in featured_placements if p.listing_id}
        if featured_ids:
            statement = statement.where(Listing.id.in_(featured_ids))
        else:
            # No featured products, return empty
            return []

    # Sorting: Featured products first, then by boost level and date
    statement = statement.order_by(
        Listing.boost_level.desc(),
        Listing.created_at.desc(),
    ).offset(skip).limit(limit)

    listings = db.exec(statement).all()

    # Get all featured product IDs for this result set
    featured_listing_ids = set()
    featured_placements = db.exec(
        select(FeaturedSelling).where(
            FeaturedSelling.placement_type == "featured_product",
            FeaturedSelling.is_active == True,
            FeaturedSelling.ends_at > datetime.utcnow(),
        )
    ).all()
    featured_listing_ids = {p.listing_id for p in featured_placements if p.listing_id}

    # Format response with featured status
    results = []
    for l in listings:
        is_featured = l.id in featured_listing_ids
        results.append({
            "id": l.id,
            "title": l.title_en or l.title_so,
            "price": l.price,
            "category_id": l.category_id,
            "subcategory_id": l.subcategory_id,
            "location": l.location,
            "images": l.images[:1] if l.images else [],
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "is_featured": is_featured,
        })

    # Sort to put featured at top
    results.sort(key=lambda x: not x["is_featured"])

    return results


@router.get("/listings/{listing_id}/attributes", response_model=List[Any])
def get_listing_attributes(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
) -> Any:
    """
    Get all attributes for a specific listing.
    """
    attributes = db.exec(
        select(ListingAttribute)
        .where(ListingAttribute.listing_id == listing_id)
        .join(Attribute, ListingAttribute.attribute_id == Attribute.id)
    ).all()

    return [
        {
            "attribute_id": la.attribute_id,
            "attribute_name": la.attribute.name if hasattr(la, 'attribute') else None,
            "attribute_slug": la.attribute.slug if hasattr(la, 'attribute') else None,
            "value": la.value,
        }
        for la in attributes
    ]


@router.get("/attribute-filters/{category_id}", response_model=Any)
def get_attribute_filters(
    *,
    db: Session = Depends(deps.get_db),
    category_id: int,
) -> Any:
    """
    Get available attribute filters and their options for a category.
    Used to build dynamic filter UI.
    """
    from app.models.category_attribute import CategoryAttribute
    from app.models.attribute_option import AttributeOption

    # Get attributes assigned to this category
    cat_attrs = db.exec(
        select(CategoryAttribute)
        .where(CategoryAttribute.category_id == category_id)
        .order_by(CategoryAttribute.sort_order)
    ).all()

    filters = []
    for cat_attr in cat_attrs:
        attr = db.get(Attribute, cat_attr.attribute_id)
        if not attr:
            continue

        # Get options if select/multiselect
        options = []
        if attr.field_type in ["select", "multiselect"]:
            opts = db.exec(
                select(AttributeOption)
                .where(AttributeOption.attribute_id == attr.id)
                .order_by(AttributeOption.sort_order)
            ).all()
            options = [
                {"value": opt.value, "display_name": opt.display_name}
                for opt in opts
            ]

        filters.append(
            {
                "id": attr.id,
                "name": attr.name,
                "slug": attr.slug,
                "field_type": attr.field_type,
                "required": cat_attr.required,
                "options": options,
            }
        )

    return {"category_id": category_id, "filters": filters}
