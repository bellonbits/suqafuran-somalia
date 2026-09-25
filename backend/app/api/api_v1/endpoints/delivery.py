from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.delivery import Delivery
from app.models.listing import Listing

router = APIRouter()

@router.get("/my/delivery", response_model=List[Delivery])
def get_my_deliveries(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all deliveries related to the current user (as buyer or seller).
    """
    deliveries = db.exec(
        select(Delivery).where(
            (Delivery.seller_id == current_user.id) | (Delivery.buyer_id == current_user.id)
        )
    ).all()
    return deliveries

@router.post("/listings/{listing_id}/delivery", response_model=Delivery)
def create_delivery(
    listing_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a new delivery for a listing.
    """
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    delivery = Delivery(
        listing_id=listing_id,
        seller_id=listing.owner_id,
        buyer_id=current_user.id,
        status="pending"
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery
