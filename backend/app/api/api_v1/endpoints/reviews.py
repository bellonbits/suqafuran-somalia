from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.review import Review, ReviewCreate, ReviewResponse
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[Review])
def list_reviews(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    List reviews for the current seller's products (paginated).
    """
    statement = (
        select(Review)
        .where(Review.seller_id == current_user.id)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    reviews = db.exec(statement).all()
    return reviews


@router.post("", response_model=Review)
def create_review(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    review_in: ReviewCreate,
) -> Any:
    """
    Create a new review (for a seller's product).
    Note: In a real scenario, only customers can create reviews.
    This endpoint is for demonstration purposes.
    """
    review = Review(
        **review_in.model_dump(),
        seller_id=current_user.id,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.post("/{review_id}/response", response_model=Review)
def add_seller_response(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    review_id: int,
    response_in: ReviewResponse,
) -> Any:
    """
    Add a seller response to a review.
    """
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this review")

    review.response = response_in.response
    review.responded_at = datetime.utcnow()

    db.add(review)
    db.commit()
    db.refresh(review)
    return review
