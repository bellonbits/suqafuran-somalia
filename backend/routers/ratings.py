from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from database import get_db
from models import Rating, Order, OrderStatus, User, Seller
from app.api.deps import get_current_user as get_current_user_app
import uuid

router = APIRouter(prefix="/ratings", tags=["ratings"])

@router.post("/{order_id}/rate")
def submit_rating(
    order_id: str,
    rating_data: dict,
    current_user: User = Depends(get_current_user_app),
    db: Session = Depends(get_db)
):
    """Submit a rating for a delivered order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify user owns the order
    if order.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only rate your own orders")

    # Can only rate delivered orders
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="You can only rate delivered orders")

    # Check if already rated
    existing_rating = db.query(Rating).filter(Rating.order_id == order_id).first()
    if existing_rating:
        raise HTTPException(status_code=400, detail="This order has already been rated")

    try:
        rating_value = rating_data.get("rating")
        review_text = rating_data.get("review", "")

        # Validate rating value
        if not isinstance(rating_value, int) or rating_value < 1 or rating_value > 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

        rating = Rating(
            id=f"RAT-{uuid.uuid4().hex[:12]}",
            order_id=order_id,
            user_id=str(current_user.id),
            seller_id=order.seller_id,
            rating=rating_value,
            review_text=review_text if review_text else None,
            is_verified_purchase=True
        )
        db.add(rating)
        db.commit()
        db.refresh(rating)

        return {
            "success": True,
            "rating_id": rating.id,
            "order_id": order.id,
            "rating": rating.rating,
            "message": "Rating submitted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seller/{seller_id}/reviews")
def get_seller_reviews(
    seller_id: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get all reviews for a seller"""
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    ratings = db.query(Rating).filter(
        Rating.seller_id == seller_id
    ).order_by(Rating.created_at.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": rating.id,
            "order_id": rating.order_id,
            "rating": rating.rating,
            "review_text": rating.review_text,
            "reviewer_name": rating.user.full_name if rating.user else "Anonymous",
            "is_verified_purchase": rating.is_verified_purchase,
            "helpful_count": rating.helpful_count,
            "created_at": rating.created_at.isoformat()
        }
        for rating in ratings
    ]


@router.get("/seller/{seller_id}/stats")
def get_seller_rating_stats(
    seller_id: str,
    db: Session = Depends(get_db)
):
    """Get rating statistics for a seller"""
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    ratings = db.query(Rating).filter(Rating.seller_id == seller_id).all()
    
    if not ratings:
        return {
            "seller_id": seller_id,
            "total_ratings": 0,
            "average_rating": 0,
            "rating_distribution": {
                "5": 0,
                "4": 0,
                "3": 0,
                "2": 0,
                "1": 0
            },
            "verified_purchases": 0
        }

    rating_distribution = {
        "5": len([r for r in ratings if r.rating == 5]),
        "4": len([r for r in ratings if r.rating == 4]),
        "3": len([r for r in ratings if r.rating == 3]),
        "2": len([r for r in ratings if r.rating == 2]),
        "1": len([r for r in ratings if r.rating == 1])
    }

    total_rating = sum(r.rating for r in ratings)
    average_rating = round(total_rating / len(ratings), 1)
    verified_count = sum(1 for r in ratings if r.is_verified_purchase)

    return {
        "seller_id": seller_id,
        "seller_name": seller.shop_name,
        "total_ratings": len(ratings),
        "average_rating": average_rating,
        "rating_distribution": rating_distribution,
        "verified_purchases": verified_count,
        "percentage_recommended": round((sum(1 for r in ratings if r.rating >= 4) / len(ratings) * 100), 1)
    }


@router.post("/order/{order_id}/helpful/{rating_id}")
def mark_review_helpful(
    order_id: str,
    rating_id: str,
    current_user: User = Depends(get_current_user_app),
    db: Session = Depends(get_db)
):
    """Mark a review as helpful"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Review not found")

    try:
        rating.helpful_count += 1
        db.commit()

        return {
            "success": True,
            "rating_id": rating_id,
            "helpful_count": rating.helpful_count,
            "message": "Review marked as helpful"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/order/{order_id}/rating")
def get_order_rating(
    order_id: str,
    current_user: User = Depends(get_current_user_app),
    db: Session = Depends(get_db)
):
    """Get rating for a specific order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify user owns the order
    if order.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only view your own order ratings")

    rating = db.query(Rating).filter(Rating.order_id == order_id).first()
    
    if not rating:
        return {
            "has_rating": False,
            "order_id": order_id,
            "message": "This order has not been rated yet"
        }

    return {
        "has_rating": True,
        "id": rating.id,
        "order_id": rating.order_id,
        "rating": rating.rating,
        "review_text": rating.review_text,
        "created_at": rating.created_at.isoformat(),
        "updated_at": rating.updated_at.isoformat()
    }

