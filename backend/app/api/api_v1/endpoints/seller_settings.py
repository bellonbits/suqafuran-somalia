from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.seller_settings import SellerSettings, SellerSettingsCreate, SellerSettingsUpdate
from app.models.user import User

router = APIRouter()


@router.get("", response_model=SellerSettings)
def get_seller_settings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the current seller's notification settings.
    """
    statement = select(SellerSettings).where(SellerSettings.seller_id == current_user.id)
    settings = db.exec(statement).first()

    if not settings:
        # Create default settings if they don't exist
        settings = SellerSettings(seller_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.post("", response_model=SellerSettings)
def create_seller_settings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    settings_in: SellerSettingsCreate,
) -> Any:
    """
    Create notification settings for the current seller.
    """
    # Check if settings already exist
    statement = select(SellerSettings).where(SellerSettings.seller_id == current_user.id)
    existing_settings = db.exec(statement).first()

    if existing_settings:
        raise HTTPException(status_code=400, detail="Settings already exist")

    settings = SellerSettings(
        **settings_in.model_dump(),
        seller_id=current_user.id,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.put("", response_model=SellerSettings)
def update_seller_settings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    settings_in: SellerSettingsUpdate,
) -> Any:
    """
    Update the current seller's notification settings.
    """
    statement = select(SellerSettings).where(SellerSettings.seller_id == current_user.id)
    settings = db.exec(statement).first()

    if not settings:
        # Create default settings if they don't exist
        settings = SellerSettings(seller_id=current_user.id)
        db.add(settings)

    update_data = settings_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
