from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.attribute import Attribute, AttributeCreate, AttributeUpdate, AttributeRead
from app.models.attribute_group import AttributeGroup, AttributeGroupCreate, AttributeGroupRead
from app.models.attribute_option import AttributeOption, AttributeOptionCreate, AttributeOptionRead

router = APIRouter()


# ============== ATTRIBUTE GROUPS ==============

@router.get("/groups", response_model=List[AttributeGroupRead])
def list_attribute_groups(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List all attribute groups."""
    return db.exec(
        select(AttributeGroup).offset(skip).limit(limit).order_by(AttributeGroup.name)
    ).all()


@router.post("/groups", response_model=AttributeGroupRead)
def create_attribute_group(
    *,
    db: Session = Depends(deps.get_db),
    group_in: AttributeGroupCreate,
) -> Any:
    """Create a new attribute group."""
    group = AttributeGroup.from_orm(group_in)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


# ============== ATTRIBUTES ==============

@router.get("", response_model=List[AttributeRead])
def list_attributes(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List attributes with optional group filter."""
    statement = select(Attribute).offset(skip).limit(limit)

    if group_id:
        statement = statement.where(Attribute.attribute_group_id == group_id)

    return db.exec(statement.order_by(Attribute.name)).all()


@router.get("/{attribute_id}", response_model=AttributeRead)
def get_attribute(
    *,
    db: Session = Depends(deps.get_db),
    attribute_id: int,
) -> Any:
    """Get a specific attribute."""
    attribute = db.get(Attribute, attribute_id)
    if not attribute:
        raise HTTPException(status_code=404, detail="Attribute not found")
    return attribute


@router.post("", response_model=AttributeRead)
def create_attribute(
    *,
    db: Session = Depends(deps.get_db),
    attribute_in: AttributeCreate,
) -> Any:
    """Create a new attribute."""
    attribute = Attribute.from_orm(attribute_in)
    db.add(attribute)
    db.commit()
    db.refresh(attribute)
    return attribute


@router.put("/{attribute_id}", response_model=AttributeRead)
def update_attribute(
    *,
    db: Session = Depends(deps.get_db),
    attribute_id: int,
    attribute_in: AttributeUpdate,
) -> Any:
    """Update an attribute."""
    attribute = db.get(Attribute, attribute_id)
    if not attribute:
        raise HTTPException(status_code=404, detail="Attribute not found")

    update_data = attribute_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(attribute, key, value)

    db.add(attribute)
    db.commit()
    db.refresh(attribute)
    return attribute


@router.delete("/{attribute_id}")
def delete_attribute(
    *,
    db: Session = Depends(deps.get_db),
    attribute_id: int,
) -> Any:
    """Delete an attribute."""
    attribute = db.get(Attribute, attribute_id)
    if not attribute:
        raise HTTPException(status_code=404, detail="Attribute not found")

    db.delete(attribute)
    db.commit()
    return {"ok": True}


# ============== ATTRIBUTE OPTIONS ==============

@router.get("/{attribute_id}/options", response_model=List[AttributeOptionRead])
def list_attribute_options(
    *,
    db: Session = Depends(deps.get_db),
    attribute_id: int,
) -> Any:
    """List options for an attribute."""
    return db.exec(
        select(AttributeOption)
        .where(AttributeOption.attribute_id == attribute_id)
        .order_by(AttributeOption.sort_order)
    ).all()


@router.post("/{attribute_id}/options", response_model=AttributeOptionRead)
def create_attribute_option(
    *,
    db: Session = Depends(deps.get_db),
    attribute_id: int,
    option_in: AttributeOptionCreate,
) -> Any:
    """Create an attribute option."""
    # Verify attribute exists
    attribute = db.get(Attribute, option_in.attribute_id)
    if not attribute:
        raise HTTPException(status_code=404, detail="Attribute not found")

    option = AttributeOption.from_orm(option_in)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


@router.delete("/{attribute_id}/options/{option_id}")
def delete_attribute_option(
    *,
    db: Session = Depends(deps.get_db),
    attribute_id: int,
    option_id: int,
) -> Any:
    """Delete an attribute option."""
    option = db.get(AttributeOption, option_id)
    if not option or option.attribute_id != attribute_id:
        raise HTTPException(status_code=404, detail="Option not found")

    db.delete(option)
    db.commit()
    return {"ok": True}
