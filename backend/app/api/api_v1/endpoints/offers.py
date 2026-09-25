"""Offers endpoints for marketplace negotiations."""

from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.api import deps
from app.models.offer import Offer, OfferCreate, OfferRead, OfferUpdate
from app.models.user import User
from app.models.listing import Listing
from app.crud.crud_offer import crud_offer
from app.services.user_notification_service import user_notification_service

router = APIRouter()


@router.post("/", response_model=OfferRead)
def create_offer(
    *,
    db: Session = Depends(deps.get_db),
    offer_in: OfferCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a new offer on a listing.
    """
    listing = db.get(Listing, offer_in.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot make offer on your own listing")

    # Check for existing pending offer from this buyer
    existing = db.query(Offer).filter(
        Offer.listing_id == offer_in.listing_id,
        Offer.buyer_id == current_user.id,
        Offer.status == "pending",
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending offer on this listing")

    offer = crud_offer.create(
        db,
        obj_in=offer_in.model_dump(),
        buyer_id=current_user.id,
    )

    # Send email notification to seller
    seller = listing.owner
    try:
        user_notification_service.notify_new_offer(
            seller=seller,
            item_title=listing.title_en,
            offer_amount=f"{offer_in.amount:,.0f}",
            offer_id=offer.id,
        )
    except Exception:
        pass

    return offer


@router.get("/my-offers", response_model=List[OfferRead])
def get_my_offers(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all offers made by current user (as buyer).
    """
    offers = db.query(Offer).filter(Offer.buyer_id == current_user.id).all()
    return offers


@router.get("/{offer_id}", response_model=OfferRead)
def get_offer(
    *,
    db: Session = Depends(deps.get_db),
    offer_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get a specific offer.
    """
    offer = db.get(Offer, offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    # Authorization check
    listing = db.get(Listing, offer.listing_id)
    if current_user.id != offer.buyer_id and current_user.id != listing.owner_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this offer")

    return offer


@router.get("/listing/{listing_id}", response_model=List[OfferRead])
def get_listing_offers(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all offers for a listing (only seller can view).
    """
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only seller can view offers")

    return crud_offer.get_by_listing(db, listing_id)


@router.patch("/{offer_id}", response_model=OfferRead)
def update_offer(
    *,
    db: Session = Depends(deps.get_db),
    offer_id: int,
    offer_in: OfferUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update offer status (accept/reject).
    """
    offer = db.get(Offer, offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    listing = db.get(Listing, offer.listing_id)
    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only seller can update offers")

    if offer_in.status == "accepted":
        listing.status = "sold"
        db.add(listing)

    offer = crud_offer.update(db, db_obj=offer, obj_in=offer_in.model_dump(exclude_unset=True))

    return offer


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(
    *,
    db: Session = Depends(deps.get_db),
    offer_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """
    Withdraw an offer (buyer only).
    """
    offer = db.get(Offer, offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only offer maker can withdraw")

    if offer.status != "pending":
        raise HTTPException(status_code=400, detail="Can only withdraw pending offers")

    offer.status = "withdrawn"
    db.add(offer)
    db.commit()
