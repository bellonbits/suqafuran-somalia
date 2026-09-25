from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.subcategory import Subcategory, SubcategoryCreate, SubcategoryUpdate, SubcategoryRead

router = APIRouter()


@router.get("", response_model=List[SubcategoryRead])
def list_subcategories(
    *,
    db: Session = Depends(deps.get_db),
    category_id: int = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List subcategories with optional category filter."""
    statement = select(Subcategory).offset(skip).limit(limit)

    if category_id:
        statement = statement.where(Subcategory.category_id == category_id)

    statement = statement.order_by(Subcategory.name_en)
    return db.exec(statement).all()


@router.get("/{subcategory_id}", response_model=SubcategoryRead)
def get_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_id: int,
) -> Any:
    """Get a specific subcategory."""
    subcategory = db.get(Subcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return subcategory


@router.post("", response_model=SubcategoryRead)
def create_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_in: SubcategoryCreate,
) -> Any:
    """Create a new subcategory."""
    subcategory = Subcategory.from_orm(subcategory_in)
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    return subcategory


@router.put("/{subcategory_id}", response_model=SubcategoryRead)
def update_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_id: int,
    subcategory_in: SubcategoryUpdate,
) -> Any:
    """Update a subcategory."""
    subcategory = db.get(Subcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    update_data = subcategory_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subcategory, key, value)

    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    return subcategory


@router.delete("/{subcategory_id}")
def delete_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_id: int,
) -> Any:
    """Delete a subcategory."""
    subcategory = db.get(Subcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    db.delete(subcategory)
    db.commit()
    return {"ok": True}
