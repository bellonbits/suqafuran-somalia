from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.api import deps
from app.crud import crud_listing, crud_wallet
from app.models.listing import Listing
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter()

BOOST_PRICES = {
    1: {"name": "Basic", "price": 500, "days": 7},
    2: {"name": "VIP", "price": 1500, "days": 14},
    3: {"name": "Diamond", "price": 3000, "days": 30},
}

class BoostApplyRequest(BaseModel):
    listing_id: int
    boost_level: int  # 1, 2, or 3

@router.post("/apply", response_model=dict)
def apply_boost(
    *,
    db: Session = Depends(deps.get_db),
    boost_in: BoostApplyRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Apply a premium boost to a listing.
    """
    if boost_in.boost_level not in BOOST_PRICES:
        raise HTTPException(status_code=400, detail="Invalid boost level")
    
    listing = crud_listing.get_listing(db, id=boost_in.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to boost this listing")
    
    # Check wallet balance
    wallet = crud_wallet.get_wallet_by_user_id(db, user_id=current_user.id)
    if not wallet:
        wallet = crud_wallet.create_wallet(db, user_id=current_user.id)
    
    boost_config = BOOST_PRICES[boost_in.boost_level]
    price = boost_config["price"]
    
    if wallet.balance < price:
        raise HTTPException(status_code=400, detail=f"Insufficient funds. Need {price} KSh")
    
    # Deduct funds
    crud_wallet.deduct_funds(
        db, 
        wallet=wallet, 
        amount=price, 
        description=f"Promoted listing: {listing.title} ({boost_config['name']})",
        type="payment"
    )
    
    # Update listing
    listing.boost_level = boost_in.boost_level
    listing.boost_expires_at = datetime.utcnow() + timedelta(days=boost_config["days"])
    listing.updated_at = datetime.utcnow()
    
    db.add(listing)
    db.commit()
    db.refresh(listing)
    
    return {
        "message": f"Successfully upgraded to {boost_config['name']}",
        "boost_expires_at": listing.boost_expires_at,
        "new_balance": wallet.balance
    }

@router.get("/prices", response_model=dict)
def get_boost_prices() -> Any:
    """
    Get available boost levels and their prices.
    """
    return BOOST_PRICES
