from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from app.api import deps
from app.models.delivery_zone import DeliveryZone, DeliveryZoneCreate, DeliveryZoneUpdate
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[DeliveryZone])
def list_delivery_zones(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    List delivery zones for the current seller (paginated).
    """
    statement = (
        select(DeliveryZone)
        .where(DeliveryZone.seller_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    zones = db.exec(statement).all()
    return zones


@router.post("", response_model=DeliveryZone)
def create_delivery_zone(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    zone_in: DeliveryZoneCreate,
) -> Any:
    """
    Create a new delivery zone for the current seller.
    """
    zone = DeliveryZone(
        **zone_in.model_dump(),
        seller_id=current_user.id,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.put("/{zone_id}", response_model=DeliveryZone)
def update_delivery_zone(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    zone_id: int,
    zone_in: DeliveryZoneUpdate,
) -> Any:
    """
    Update a delivery zone.
    """
    zone = db.get(DeliveryZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Delivery zone not found")

    if zone.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this zone")

    update_data = zone_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(zone, key, value)

    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/{zone_id}")
def delete_delivery_zone(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    zone_id: int,
) -> Any:
    """
    Delete a delivery zone.
    """
    zone = db.get(DeliveryZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Delivery zone not found")

    if zone.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this zone")

    db.delete(zone)
    db.commit()
    return {"success": True, "message": "Delivery zone deleted"}
