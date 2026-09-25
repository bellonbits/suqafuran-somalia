from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from app.api import deps
from app.models.listing import Listing
from app.models.message import Message
from app.models.favorite import Favorite
from app.models.wallet import Wallet

router = APIRouter()

@router.get("/stats")
def get_user_stats(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
):
    """
    Get statistics for the current user's dashboard.
    """
    # Count user's listings
    listings_count = db.exec(select(func.count()).select_from(Listing).where(Listing.owner_id == current_user.id)).one()
    
    # Count unique conversations (using sender or receiver)
    messages_count = db.exec(select(func.count(Message.id)).where(
        (Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)
    )).one()
    
    # Count favorites
    favorites_count = db.exec(select(func.count()).select_from(Favorite).where(Favorite.user_id == current_user.id)).one()
    
    # Get wallet balance
    wallet = db.exec(select(Wallet).where(Wallet.user_id == current_user.id)).first()
    balance = wallet.balance if wallet else 0.0
    
    # Get real views (listing views sum + profile views)
    listing_views = db.exec(select(func.sum(Listing.views)).where(Listing.owner_id == current_user.id)).one() or 0
    total_views = listing_views + current_user.profile_views
    
    return {
        "listings": listings_count,
        "messages": messages_count,
        "favorites": favorites_count,
        "views": f"{total_views:,}", # Format with commas
        "balance": balance
    }
