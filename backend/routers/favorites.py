from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from utils.security import get_current_user
from models import User
from typing import Optional
import json

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("/")
def get_my_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get user's favorite listings"""
    try:
        if not current_user.favorites:
            return []

        favorites = json.loads(current_user.favorites) if isinstance(current_user.favorites, str) else current_user.favorites or []
        if not isinstance(favorites, list):
            return []

        favorite_ids = [int(fav_id) if isinstance(fav_id, (int, str)) else fav_id.get("id") for fav_id in favorites if fav_id]

        if not favorite_ids:
            return []

        # Fetch listing details using raw SQL to avoid import issues
        query_text = text("""
            SELECT id, title_en, title_so, description_en, price, images, status, category_id, owner_id, created_at
            FROM listing
            WHERE id = ANY(:ids) AND status = 'active'
            LIMIT :limit OFFSET :skip
        """)

        result = db.execute(query_text, {"ids": favorite_ids, "limit": limit, "skip": skip})
        listings = result.fetchall()

        return [
            {
                "id": row[0],
                "title_en": row[1],
                "title_so": row[2],
                "description_en": row[3],
                "price": row[4],
                "images": row[5],
                "status": row[6],
                "category_id": row[7],
                "owner_id": row[8],
                "created_at": row[9].isoformat() if row[9] else None
            }
            for row in listings
        ]
    except Exception as e:
        return []


@router.post("/{listing_id}")
def add_favorite(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add listing to favorites"""
    try:
        # Check if listing exists using raw SQL
        result = db.execute(text("SELECT id FROM listing WHERE id = :id"), {"id": listing_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Listing not found")

        # Get current favorites
        favorites = json.loads(current_user.favorites) if isinstance(current_user.favorites, str) else current_user.favorites or []
        if not isinstance(favorites, list):
            favorites = []

        # Add if not already there
        if listing_id not in favorites:
            favorites.append(listing_id)
            current_user.favorites = json.dumps(favorites)
            db.add(current_user)
            db.commit()

        return {"message": "Added to favorites", "favorites": favorites}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{listing_id}")
def remove_favorite(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove listing from favorites"""
    try:
        favorites = json.loads(current_user.favorites) if isinstance(current_user.favorites, str) else current_user.favorites or []
        if not isinstance(favorites, list):
            favorites = []

        if listing_id in favorites:
            favorites.remove(listing_id)
            current_user.favorites = json.dumps(favorites)
            db.add(current_user)
            db.commit()

        return {"message": "Removed from favorites", "favorites": favorites}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
