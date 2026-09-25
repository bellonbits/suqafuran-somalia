from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session
from app.api import deps
from app.crud.crud_saved_address import crud_saved_address
from app.models.saved_address import SavedAddress

router = APIRouter()


class SavedAddressCreate(BaseModel):
    label: str = "Saved address"
    formatted_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False


class SavedAddressUpdate(BaseModel):
    label: Optional[str] = None
    is_default: Optional[bool] = None


@router.get("/", response_model=List[SavedAddress])
def get_my_addresses(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """List the current user's saved delivery/pickup addresses."""
    return crud_saved_address.get_user_addresses(db, user_id=current_user.id)


@router.post("/", response_model=SavedAddress)
def create_address(
    *,
    payload: SavedAddressCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """Save a location (picked via the location picker) for quick reuse."""
    return crud_saved_address.create(
        db,
        user_id=current_user.id,
        label=payload.label,
        formatted_address=payload.formatted_address,
        lat=payload.lat,
        lng=payload.lng,
        is_default=payload.is_default,
    )


@router.patch("/{address_id}", response_model=SavedAddress)
def update_address(
    *,
    address_id: int,
    payload: SavedAddressUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    updated = crud_saved_address.update(
        db, address_id=address_id, user_id=current_user.id,
        updates=payload.model_dump(exclude_unset=True),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Saved address not found")
    return updated


@router.delete("/{address_id}")
def delete_address(
    *,
    address_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    success = crud_saved_address.remove(db, address_id=address_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Saved address not found")
    return {"message": "Success"}
