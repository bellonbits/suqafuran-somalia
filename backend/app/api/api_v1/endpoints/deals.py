from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.user import User
from app.models.listing import Listing
from app.models.meeting_deal import Deal
from app.models.notification import Notification
from app.services.trust_service import trust_service
from pydantic import BaseModel

router = APIRouter()


class MarkPurchasedIn(BaseModel):
    listing_id: int


def _seller_name(user: Optional[User]) -> str:
    if not user:
        return "The seller"
    return user.business_name or user.full_name or "The seller"


@router.post("/mark-purchased", response_model=Deal)
def mark_purchased(
    *,
    db: Session = Depends(deps.get_db),
    payload: MarkPurchasedIn,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Buyer indicates they purchased a listing. Creates or updates the Deal
    record for this (listing, buyer, seller) and notifies the seller to
    confirm. Does NOT close the listing or touch trust scores yet -- that
    only happens once the seller also confirms (see /seller-confirm).
    """
    listing = db.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't confirm a purchase on your own listing")

    deal = db.exec(
        select(Deal).where(
            Deal.listing_id == listing.id,
            Deal.buyer_id == current_user.id,
            Deal.seller_id == listing.owner_id,
        )
    ).first()

    if not deal:
        deal = Deal(listing_id=listing.id, buyer_id=current_user.id, seller_id=listing.owner_id)

    deal.buyer_confirmed = True
    deal.buyer_confirmed_at = datetime.utcnow()
    db.add(deal)
    db.commit()
    db.refresh(deal)

    buyer_name = current_user.full_name or "A buyer"
    listing_title = listing.title_en
    notification = Notification(
        user_id=listing.owner_id,
        type="purchase_confirmation_requested",
        data={
            "deal_id": deal.id,
            "listing_id": listing.id,
            "message": f"{buyer_name} indicated they purchased \"{listing_title}\". Confirm the sale?",
        },
    )
    db.add(notification)
    db.commit()

    return deal


@router.post("/{deal_id}/seller-confirm", response_model=Deal)
def seller_confirm(
    *,
    db: Session = Depends(deps.get_db),
    deal_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Seller confirms a buyer-reported purchase. Only closes the listing
    and boosts trust scores once BOTH sides have confirmed."""
    deal = db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to confirm this deal")

    deal.seller_confirmed = True
    deal.seller_confirmed_at = datetime.utcnow()

    if deal.buyer_confirmed:
        deal.outcome = "bought"
        listing = db.get(Listing, deal.listing_id)
        if listing:
            listing.status = "closed"
            db.add(listing)
        trust_service.update_trust_score(db, deal.buyer_id, 50, "Successful deal completion")
        trust_service.update_trust_score(db, deal.seller_id, 50, "Successful deal completion")

    db.add(deal)
    db.commit()
    db.refresh(deal)

    if deal.outcome == "bought":
        listing = db.get(Listing, deal.listing_id)
        notification = Notification(
            user_id=deal.buyer_id,
            type="purchase_confirmed",
            data={
                "deal_id": deal.id,
                "listing_id": deal.listing_id,
                "message": f"{_seller_name(db.get(User, deal.seller_id))} confirmed your purchase of \"{listing.title_en if listing else 'the listing'}\".",
            },
        )
        db.add(notification)
        db.commit()

    return deal


@router.post("/{deal_id}/seller-deny", response_model=Deal)
def seller_deny(
    *,
    db: Session = Depends(deps.get_db),
    deal_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Seller indicates this purchase did not happen."""
    deal = db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this deal")

    deal.outcome = "not_bought"
    db.add(deal)
    db.commit()
    db.refresh(deal)

    listing = db.get(Listing, deal.listing_id)
    notification = Notification(
        user_id=deal.buyer_id,
        type="purchase_denied",
        data={
            "deal_id": deal.id,
            "listing_id": deal.listing_id,
            "message": f"{_seller_name(db.get(User, deal.seller_id))} indicated this purchase didn't happen for \"{listing.title_en if listing else 'the listing'}\".",
        },
    )
    db.add(notification)
    db.commit()

    return deal


@router.get("/", response_model=Optional[Deal])
def get_deal(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    buyer_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch the current deal state for a listing+buyer pair. Callable by
    the buyer, the seller, or an admin."""
    deal = db.exec(
        select(Deal).where(Deal.listing_id == listing_id, Deal.buyer_id == buyer_id)
    ).first()

    if deal:
        allowed = current_user.id in (deal.buyer_id, deal.seller_id) or current_user.is_admin
    else:
        listing = db.get(Listing, listing_id)
        allowed = bool(listing) and (
            current_user.id in (buyer_id, listing.owner_id) or current_user.is_admin
        )

    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized to view this deal")

    return deal
