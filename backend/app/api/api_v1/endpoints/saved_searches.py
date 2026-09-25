"""Saved searches endpoints."""

from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.api import deps
from app.models.saved_search import SavedSearch, SavedSearchCreate, SavedSearchRead, SavedSearchUpdate
from app.models.user import User
from app.crud.crud_saved_search import crud_saved_search

router = APIRouter()


@router.post("/", response_model=SavedSearchRead)
def create_saved_search(
    *,
    db: Session = Depends(deps.get_db),
    search_in: SavedSearchCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a saved search.
    """
    search = crud_saved_search.create(
        db,
        obj_in=search_in.model_dump(),
        user_id=current_user.id,
    )
    return search


@router.get("/", response_model=List[SavedSearchRead])
def get_saved_searches(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all saved searches for current user.
    """
    return crud_saved_search.get_by_user(db, current_user.id)


@router.get("/{search_id}", response_model=SavedSearchRead)
def get_saved_search(
    *,
    db: Session = Depends(deps.get_db),
    search_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get a specific saved search.
    """
    search = db.get(SavedSearch, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    if search.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this search")

    return search


@router.patch("/{search_id}", response_model=SavedSearchRead)
def update_saved_search(
    *,
    db: Session = Depends(deps.get_db),
    search_id: int,
    search_in: SavedSearchUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a saved search.
    """
    search = db.get(SavedSearch, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    if search.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this search")

    search = crud_saved_search.update(
        db,
        db_obj=search,
        obj_in=search_in.model_dump(exclude_unset=True),
    )
    return search


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(
    *,
    db: Session = Depends(deps.get_db),
    search_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """
    Delete a saved search.
    """
    search = db.get(SavedSearch, search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    if search.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this search")

    db.delete(search)
    db.commit()
