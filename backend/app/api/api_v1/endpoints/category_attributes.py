from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.category_attribute import CategoryAttribute, CategoryAttributeCreate, CategoryAttributeRead
from app.models.subcategory_attribute import SubcategoryAttribute, SubcategoryAttributeCreate, SubcategoryAttributeRead

router = APIRouter()


# ============== CATEGORY ATTRIBUTES ==============

@router.get("/category/{category_id}", response_model=List[CategoryAttributeRead])
def get_category_attributes(
    *,
    db: Session = Depends(deps.get_db),
    category_id: int,
) -> Any:
    """Get attributes for a category."""
    return db.exec(
        select(CategoryAttribute)
        .where(CategoryAttribute.category_id == category_id)
        .order_by(CategoryAttribute.sort_order)
    ).all()


@router.post("/category", response_model=CategoryAttributeRead)
def assign_attribute_to_category(
    *,
    db: Session = Depends(deps.get_db),
    assignment: CategoryAttributeCreate,
) -> Any:
    """Assign an attribute to a category."""
    # Check if already assigned
    existing = db.exec(
        select(CategoryAttribute).where(
            (CategoryAttribute.category_id == assignment.category_id) &
            (CategoryAttribute.attribute_id == assignment.attribute_id)
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Attribute already assigned to this category")

    cat_attr = CategoryAttribute.from_orm(assignment)
    db.add(cat_attr)
    db.commit()
    db.refresh(cat_attr)
    return cat_attr


@router.delete("/category/{category_id}/{attribute_id}")
def remove_attribute_from_category(
    *,
    db: Session = Depends(deps.get_db),
    category_id: int,
    attribute_id: int,
) -> Any:
    """Remove an attribute from a category."""
    assignment = db.exec(
        select(CategoryAttribute).where(
            (CategoryAttribute.category_id == category_id) &
            (CategoryAttribute.attribute_id == attribute_id)
        )
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(assignment)
    db.commit()
    return {"ok": True}


# ============== SUBCATEGORY ATTRIBUTES ==============

@router.get("/subcategory/{subcategory_id}", response_model=List[SubcategoryAttributeRead])
def get_subcategory_attributes(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_id: int,
) -> Any:
    """Get attributes for a subcategory."""
    return db.exec(
        select(SubcategoryAttribute)
        .where(SubcategoryAttribute.subcategory_id == subcategory_id)
        .order_by(SubcategoryAttribute.sort_order)
    ).all()


@router.post("/subcategory", response_model=SubcategoryAttributeRead)
def assign_attribute_to_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    assignment: SubcategoryAttributeCreate,
) -> Any:
    """Assign an attribute to a subcategory."""
    # Check if already assigned
    existing = db.exec(
        select(SubcategoryAttribute).where(
            (SubcategoryAttribute.subcategory_id == assignment.subcategory_id) &
            (SubcategoryAttribute.attribute_id == assignment.attribute_id)
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Attribute already assigned to this subcategory")

    subcat_attr = SubcategoryAttribute.from_orm(assignment)
    db.add(subcat_attr)
    db.commit()
    db.refresh(subcat_attr)
    return subcat_attr


@router.delete("/subcategory/{subcategory_id}/{attribute_id}")
def remove_attribute_from_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_id: int,
    attribute_id: int,
) -> Any:
    """Remove an attribute from a subcategory."""
    assignment = db.exec(
        select(SubcategoryAttribute).where(
            (SubcategoryAttribute.subcategory_id == subcategory_id) &
            (SubcategoryAttribute.attribute_id == attribute_id)
        )
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(assignment)
    db.commit()
    return {"ok": True}
