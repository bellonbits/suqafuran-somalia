from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.feedback import Feedback

router = APIRouter()

@router.get("/user/{user_id}/feedback", response_model=List[Feedback])
def get_user_feedback(
    user_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get all feedback received by a specific user.
    """
    feedback = db.exec(select(Feedback).where(Feedback.target_user_id == user_id)).all()
    return feedback

@router.post("/feedback", response_model=Feedback)
def create_feedback(
    *,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
    feedback_in: Feedback # Simplified for this demo
) -> Any:
    """
    Submit new feedback for a user.
    """
    feedback = Feedback(
        author_id=current_user.id,
        target_user_id=feedback_in.target_user_id,
        listing_id=feedback_in.listing_id,
        rating=feedback_in.rating,
        comment=feedback_in.comment
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/listing/{listing_id}", response_model=List[Feedback])
def get_listing_feedback(
    listing_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get all feedback for a specific listing.
    """
    feedback = db.exec(select(Feedback).where(Feedback.listing_id == listing_id)).all()
    return feedback
