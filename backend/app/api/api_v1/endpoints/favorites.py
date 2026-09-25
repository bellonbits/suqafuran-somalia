from typing import Any, List
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.api import deps
from app.crud.crud_favorite import crud_favorite
from app.models.listing import ListingRead

router = APIRouter()

@router.get("/", response_model=List[ListingRead])
def get_my_favorites(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all favorites for the current user.
    """
    # ListingRead (not the raw Listing table model) so `owner` serializes
    # through its declared OwnerRead shape instead of the SQLAlchemy
    # relationship attribute silently dropping/mis-serializing -- same fix
    # already applied to the main GET /listings/ endpoint.
    favorites = crud_favorite.get_user_favorites(db, user_id=current_user.id)
    return [ListingRead.model_validate(l) for l in favorites]

@router.post("/{listing_id}")
def add_favorite(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Add a listing to favorites.
    """
    return crud_favorite.create(db, user_id=current_user.id, listing_id=listing_id)

@router.delete("/{listing_id}")
def remove_favorite(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Remove a listing from favorites.
    """
    crud_favorite.remove(db, user_id=current_user.id, listing_id=listing_id)
    return {"status": "success"}
