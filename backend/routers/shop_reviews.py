from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from sqlalchemy.orm import Session
from database import get_db
from models import ShopReview, ShopFeedback, ShopFollow
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional, List
import uuid
from datetime import datetime

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    review: str = Field(..., description="Review text content")
    display_name: Optional[str] = Field("Anonymous", description="Name to display for reviewer")
    user_id: int = Field(..., description="ID of the user submitting review")
    reviewer_email: Optional[str] = Field(None, description="Email of reviewer")
    is_verified_purchase: Optional[bool] = Field(False, description="Whether this is from verified purchase")

    class Config:
        json_schema_extra = {
            "example": {
                "rating": 5,
                "review": "Great shop with excellent service!",
                "display_name": "John Doe",
                "user_id": 1,
                "reviewer_email": "john@example.com",
                "is_verified_purchase": True
            }
        }

class ReviewResponse(BaseModel):
    id: str
    display_name: str
    rating: int
    review: str
    is_verified_purchase: bool
    created_at: Optional[str]

class ReviewsListResponse(BaseModel):
    reviews: List[ReviewResponse]
    average_rating: float
    total_reviews: int
    verified_reviews_count: int

class FeedbackCreate(BaseModel):
    feedback_text: str = Field(..., description="Feedback text content")
    display_name: Optional[str] = Field("Anonymous", description="Name to display for feedback author")
    user_id: int = Field(..., description="ID of the user submitting feedback")
    is_public: Optional[bool] = Field(True, description="Whether feedback should be public")

    class Config:
        json_schema_extra = {
            "example": {
                "feedback_text": "Great experience shopping here!",
                "display_name": "Jane Smith",
                "user_id": 1,
                "is_public": True
            }
        }

class FeedbackResponse(BaseModel):
    id: str
    display_name: str
    feedback_text: str
    created_at: Optional[str]

class FeedbackListResponse(BaseModel):
    feedback: List[FeedbackResponse]

class FollowCreate(BaseModel):
    user_id: int = Field(..., description="ID of the user following the shop")

    class Config:
        json_schema_extra = {
            "example": {"user_id": 1}
        }

class SuccessResponse(BaseModel):
    message: str

class SuccessIdResponse(BaseModel):
    id: str
    message: str

router = APIRouter(tags=["shop-reviews"])

@router.get("/listings/shops/{shop_id}/reviews", response_model=ReviewsListResponse, tags=["Shop Reviews"])
def get_reviews(
    shop_id: str = Path(..., description="ID of the shop"),
    db: Session = Depends(get_db)
):
    """Get all reviews for a shop with aggregate statistics."""
    try:
        reviews = db.query(ShopReview).filter(ShopReview.seller_id == shop_id).all()
        total = db.query(func.count(ShopReview.id)).filter(ShopReview.seller_id == shop_id).scalar()
        avg = db.query(func.avg(ShopReview.rating)).filter(ShopReview.seller_id == shop_id).scalar()
        verified = db.query(func.count(ShopReview.id)).filter(ShopReview.seller_id == shop_id, ShopReview.is_verified_purchase == True).scalar()
        return {"reviews": [{"id": r.id, "display_name": r.display_name or "Anonymous", "rating": r.rating, "review": r.review, "is_verified_purchase": r.is_verified_purchase, "created_at": r.created_at.isoformat() if r.created_at else None} for r in reviews], "average_rating": float(avg) if avg else 0, "total_reviews": total or 0, "verified_reviews_count": verified or 0}
    except:
        return {"reviews": [], "average_rating": 0, "total_reviews": 0, "verified_reviews_count": 0}

@router.post("/listings/shops/{shop_id}/reviews", response_model=SuccessIdResponse, tags=["Shop Reviews"])
def post_review(
    shop_id: str = Path(..., description="ID of the shop"),
    data: ReviewCreate = Body(..., description="Review submission data"),
    db: Session = Depends(get_db)
):
    """Submit a review for a shop (1-5 star rating required)."""
    try:
        if not (1 <= data.rating <= 5):
            raise HTTPException(status_code=400, detail="Rating must be 1-5")
        new = ShopReview(id=str(uuid.uuid4()), seller_id=shop_id, user_id=data.user_id, rating=data.rating, review=data.review, display_name=data.display_name, reviewer_email=data.reviewer_email, is_verified_purchase=data.is_verified_purchase)
        db.add(new)
        db.commit()
        return {"id": new.id, "message": "Review submitted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/listings/shops/{shop_id}/feedback", response_model=FeedbackListResponse, tags=["Shop Feedback"])
def get_feedback(
    shop_id: str = Path(..., description="ID of the shop"),
    db: Session = Depends(get_db)
):
    """Get all feedback for a shop."""
    try:
        feedback = db.query(ShopFeedback).filter(ShopFeedback.seller_id == shop_id).all()
        return {"feedback": [{"id": f.id, "display_name": f.display_name or "Anonymous", "feedback_text": f.feedback_text, "created_at": f.created_at.isoformat() if f.created_at else None} for f in feedback]}
    except:
        return {"feedback": []}

@router.post("/listings/shops/{shop_id}/feedback", response_model=SuccessIdResponse, tags=["Shop Feedback"])
def post_feedback(
    shop_id: str = Path(..., description="ID of the shop"),
    data: FeedbackCreate = Body(..., description="Feedback submission data"),
    db: Session = Depends(get_db)
):
    """Submit feedback for a shop."""
    try:
        new = ShopFeedback(id=str(uuid.uuid4()), seller_id=shop_id, user_id=data.user_id, feedback_text=data.feedback_text, display_name=data.display_name, is_public=data.is_public)
        db.add(new)
        db.commit()
        return {"id": new.id, "message": "Feedback submitted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/listings/shops/{shop_id}/follow", response_model=SuccessResponse, tags=["Shop Follow"])
def follow(
    shop_id: str = Path(..., description="ID of the shop to follow"),
    data: FollowCreate = Body(..., description="Follow request data"),
    db: Session = Depends(get_db)
):
    """Follow a shop to receive updates."""
    try:
        if not data.user_id:
            raise HTTPException(status_code=400, detail="User ID required")
        new = ShopFollow(id=str(uuid.uuid4()), user_id=data.user_id, seller_id=shop_id)
        db.add(new)
        db.commit()
        return {"message": "Shop followed successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/listings/shops/{shop_id}/follow", response_model=SuccessResponse, tags=["Shop Follow"])
def unfollow(
    shop_id: str = Path(..., description="ID of the shop to unfollow"),
    user_id: int = Query(..., description="ID of the user unfollowing"),
    db: Session = Depends(get_db)
):
    """Unfollow a shop."""
    try:
        follow = db.query(ShopFollow).filter(ShopFollow.user_id == user_id, ShopFollow.seller_id == shop_id).first()
        if follow:
            db.delete(follow)
            db.commit()
        return {"message": "Shop unfollowed successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
