from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.seller_profile import SellerProfile, SellerProfileCreate, SellerProfileUpdate
from app.models.user import User

router = APIRouter()


@router.get("", response_model=SellerProfile)
def get_seller_profile(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the current seller's profile.
    """
    statement = select(SellerProfile).where(SellerProfile.seller_id == current_user.id)
    profile = db.exec(statement).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    return profile


@router.post("", response_model=SellerProfile)
def create_seller_profile(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    profile_in: SellerProfileCreate,
) -> Any:
    """
    Create a seller profile for the current user.
    """
    # Check if profile already exists
    statement = select(SellerProfile).where(SellerProfile.seller_id == current_user.id)
    existing_profile = db.exec(statement).first()

    if existing_profile:
        raise HTTPException(status_code=400, detail="Seller profile already exists")

    profile = SellerProfile(
        **profile_in.model_dump(),
        seller_id=current_user.id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("", response_model=SellerProfile)
def update_seller_profile(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    profile_in: SellerProfileUpdate,
) -> Any:
    """
    Update the current seller's profile.
    """
    statement = select(SellerProfile).where(SellerProfile.seller_id == current_user.id)
    profile = db.exec(statement).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    update_data = profile_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
