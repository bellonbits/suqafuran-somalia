from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.models.listing import Category, SubSubCategory
from app.models.subcategory import Subcategory
from app.models.user import User
from app.db import get_session
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/categories", tags=["categories"])


# Response schemas
class CategoryRead(dict):
    id: int
    name_en: str
    name_so: Optional[str]
    slug: str
    icon_name: str


@router.get("", response_model=List[dict])
async def list_categories(
    parent_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """Get categories (root or by parent)"""
    if parent_id is None:
        # Get root categories
        query = select(Category)
    else:
        # Get subcategories for a parent
        query = select(Subcategory).where(Subcategory.category_id == parent_id)

    items = session.exec(query).all()

    return [
        {
            "id": item.id,
            "name_en": item.name_en,
            "name_so": getattr(item, "name_so", None),
            "slug": item.slug,
            "icon_name": getattr(item, "icon_name", None),
            "image_url": getattr(item, "image_url", None),
        }
        for item in items
    ]


@router.get("/{category_id}", response_model=dict)
async def get_category(
    category_id: int,
    session: Session = Depends(get_session)
):
    """Get category with subcategories"""
    category = session.exec(select(Category).where(Category.id == category_id)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    subcategories = session.exec(
        select(Subcategory).where(Subcategory.category_id == category_id)
    ).all()

    return {
        "id": category.id,
        "name_en": category.name_en,
        "name_so": category.name_so,
        "slug": category.slug,
        "icon_name": category.icon_name,
        "image_url": category.image_url,
        "subcategories": [
            {
                "id": sub.id,
                "name_en": sub.name_en,
                "name_so": sub.name_so,
                "slug": sub.slug,
                "image_url": sub.image_url,
            }
            for sub in subcategories
        ],
        "count": len(subcategories)
    }


@router.get("/{category_id}/subcategories", response_model=List[dict])
async def get_subcategories(
    category_id: int,
    session: Session = Depends(get_session)
):
    """Get subcategories for a category"""
    category = session.exec(select(Category).where(Category.id == category_id)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    subcategories = session.exec(
        select(Subcategory).where(Subcategory.category_id == category_id)
    ).all()

    return [
        {
            "id": sub.id,
            "name_en": sub.name_en,
            "name_so": sub.name_so,
            "slug": sub.slug,
            "image_url": sub.image_url,
        }
        for sub in subcategories
    ]


@router.get("/by-slug/{slug}", response_model=dict)
async def get_category_by_slug(
    slug: str,
    session: Session = Depends(get_session)
):
    """Get category by slug"""
    category = session.exec(select(Category).where(Category.slug == slug)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    return {
        "id": category.id,
        "name_en": category.name_en,
        "name_so": category.name_so,
        "slug": category.slug,
        "icon_name": category.icon_name,
        "image_url": category.image_url,
    }


@router.post("", response_model=dict, status_code=201)
async def create_category(
    name_en: str,
    slug: str,
    icon_name: str,
    name_so: Optional[str] = None,
    image_url: Optional[str] = None,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Create root category (admin only)"""
    # Check if slug already exists
    existing = session.exec(select(Category).where(Category.slug == slug)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Slug already exists")

    category = Category(
        name_en=name_en,
        name_so=name_so,
        slug=slug,
        icon_name=icon_name,
        image_url=image_url
    )
    session.add(category)
    session.commit()
    session.refresh(category)

    return {
        "id": category.id,
        "name_en": category.name_en,
        "name_so": category.name_so,
        "slug": category.slug,
        "icon_name": category.icon_name,
        "image_url": category.image_url,
    }


@router.post("/{category_id}/subcategories", response_model=dict, status_code=201)
async def create_subcategory(
    category_id: int,
    name_en: str,
    slug: str,
    name_so: Optional[str] = None,
    image_url: Optional[str] = None,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Create subcategory (admin only)"""
    # Verify parent category exists
    category = session.exec(select(Category).where(Category.id == category_id)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check if slug already exists for this category
    existing = session.exec(
        select(Subcategory).where(
            Subcategory.category_id == category_id,
            Subcategory.slug == slug
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Slug already exists in this category")

    subcategory = Subcategory(
        category_id=category_id,
        name_en=name_en,
        name_so=name_so,
        slug=slug,
        image_url=image_url
    )
    session.add(subcategory)
    session.commit()
    session.refresh(subcategory)

    return {
        "id": subcategory.id,
        "name_en": subcategory.name_en,
        "name_so": subcategory.name_so,
        "slug": subcategory.slug,
        "image_url": subcategory.image_url,
    }


@router.patch("/{category_id}", response_model=dict)
async def update_category(
    category_id: int,
    name_en: Optional[str] = None,
    name_so: Optional[str] = None,
    icon_name: Optional[str] = None,
    image_url: Optional[str] = None,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Update category (admin only)"""
    category = session.exec(select(Category).where(Category.id == category_id)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if name_en:
        category.name_en = name_en
    if name_so:
        category.name_so = name_so
    if icon_name:
        category.icon_name = icon_name
    if image_url:
        category.image_url = image_url

    session.add(category)
    session.commit()
    session.refresh(category)

    return {
        "id": category.id,
        "name_en": category.name_en,
        "name_so": category.name_so,
        "slug": category.slug,
        "icon_name": category.icon_name,
        "image_url": category.image_url,
    }


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """Delete category (admin only)"""
    category = session.exec(select(Category).where(Category.id == category_id)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check if has subcategories
    sub_count = session.exec(
        select(Subcategory).where(Subcategory.category_id == category_id)
    ).first()
    if sub_count:
        raise HTTPException(status_code=409, detail="Category has subcategories - delete them first")

    session.delete(category)
    session.commit()
