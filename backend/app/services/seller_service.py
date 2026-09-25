"""Seller service with duplicate prevention."""
from fastapi import HTTPException
from sqlmodel import Session, select
from app.models.listing import Seller
import logging

logger = logging.getLogger(__name__)


def check_duplicate_seller(db: Session, user_id: str | int) -> Seller | None:
    """Check if user already has an active seller account."""
    user_id_str = str(user_id)
    stmt = select(Seller).where(
        Seller.user_id == user_id_str,
        Seller.is_active == True
    )
    return db.exec(stmt).first()


def prevent_duplicate_seller(db: Session, user_id: str | int) -> None:
    """Raise an error if user already has an active seller account."""
    existing = check_duplicate_seller(db, user_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User already has an active seller account: '{existing.shop_name}'. "
                   "Each user can only have one active shop. "
                   "Contact support if you need to manage multiple shops."
        )


def create_seller_with_duplicate_check(
    db: Session,
    user_id: str | int,
    shop_name: str,
    owner_name: str,
    email: str,
    phone: str,
    address: str,
    category: str,
    lat: float = None,
    lng: float = None
) -> Seller:
    """Create a seller after checking for duplicates."""
    prevent_duplicate_seller(db, user_id)

    # Check email uniqueness
    stmt = select(Seller).where(Seller.email == email)
    existing_email = db.exec(stmt).first()
    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered as a seller"
        )

    seller = Seller(
        user_id=str(user_id),
        shop_name=shop_name,
        owner_name=owner_name,
        email=email,
        phone=phone,
        shop_address=address,
        category=category,
        location_lat=lat,
        location_lng=lng,
        verification_status="pending",
        is_active=True
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    logger.info(f"Created seller '{shop_name}' for user {user_id}")
    return seller
