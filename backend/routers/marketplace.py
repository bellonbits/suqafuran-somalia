from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status, Path, Body
from sqlalchemy.orm import Session
from database import get_db
from models import Seller, Category, Listing
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import asyncio
from datetime import datetime
import uuid

# Main marketplace router
router = APIRouter(tags=["marketplace"])

# Separate router for listings endpoints (at /listings prefix)
listings_router = APIRouter(prefix="/listings", tags=["listings"])

# Separate router for admin endpoints (at /admin prefix)
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# Notifications router
notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])


@listings_router.get("/categories")
def list_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get all categories"""
    try:
        from sqlalchemy import text
        rows = db.execute(
            text("SELECT id, name_en, name_so, slug, icon_name, image_url FROM category ORDER BY id OFFSET :skip LIMIT :limit"),
            {"skip": skip, "limit": limit}
        ).fetchall()
        return [
            {
                "id": row.id,
                "name_en": row.name_en,
                "name_so": row.name_so,
                "slug": row.slug,
                "icon_name": row.icon_name,
                "image_url": row.image_url,
                "subcategories": []
            }
            for row in rows
        ]
    except Exception as e:
        import traceback; traceback.print_exc()
        return []


@listings_router.get("/")
def list_listings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get marketplace listings"""
    try:
        query = db.query(Listing).filter(Listing.status == "active")

        if category_id:
            query = query.filter(Listing.category_id == category_id)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Listing.title_en.ilike(search_term)) |
                (Listing.description_en.ilike(search_term))
            )

        listings = query.offset(skip).limit(limit).all()

        return [
            {
                "id": listing.id,
                "title_en": listing.title_en,
                "title_so": listing.title_so,
                "description_en": listing.description_en,
                "price": listing.price,
                "images": listing.images,
                "status": listing.status,
                "category_id": listing.category_id,
                "owner_id": listing.owner_id,
                "created_at": listing.created_at.isoformat() if listing.created_at else None
            }
            for listing in listings
        ]
    except Exception as e:
        return []




@listings_router.get("/shops")
def list_public_shops(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Public endpoint: Get verified sellers/shops that have at least 1 active listing.
    Returns seller profile enriched with listing count and categories.
    """
    try:
        from sqlalchemy import text
        search_clause = ""
        params = {"skip": skip, "limit": limit}
        if search:
            search_clause = "AND (s.shop_name ILIKE :search OR s.category ILIKE :search)"
            params["search"] = f"%{search}%"

        query = text(f"""
            SELECT DISTINCT ON (s.user_id) s.id, s.user_id, s.shop_name, s.owner_name, s.category,
                   s.shop_address, s.location_lat, s.location_lng,
                   s.verification_status, s.is_active, s.created_at,
                   COUNT(DISTINCT l.id) as listing_count
            FROM sellers s
            JOIN listing l ON l.status = 'active' AND CAST(l.owner_id AS TEXT) = s.user_id
            WHERE s.verification_status = 'verified'
            AND s.is_active = true
            {search_clause}
            GROUP BY s.id, s.user_id, s.shop_name, s.owner_name, s.category,
                     s.shop_address, s.location_lat, s.location_lng,
                     s.verification_status, s.is_active, s.created_at
            HAVING COUNT(DISTINCT l.id) >= 1
            ORDER BY s.user_id, s.created_at DESC
            OFFSET :skip LIMIT :limit
        """)

        result = db.execute(query, params)
        rows = result.fetchall()

        shops = []
        for row in rows:
            # Grabbing distinct category ids for this seller
            cat_query = text("""
                SELECT DISTINCT category_id FROM listing 
                WHERE status = 'active'
                AND owner_id = :owner_id
                AND category_id IS NOT NULL
            """)
            try:
                owner_id_val = int(row[1])
            except Exception:
                owner_id_val = -1

            cat_res = db.execute(cat_query, {"owner_id": owner_id_val}).fetchall()
            cat_ids = [r[0] for r in cat_res if r[0]]

            if category_id and category_id not in cat_ids:
                continue

            # Grab first listing image as cover
            cover_image = None
            first_listing_query = text("""
                SELECT images FROM listing 
                WHERE status = 'active'
                AND owner_id = :owner_id
                LIMIT 1
            """)
            first_listing_res = db.execute(first_listing_query, {"owner_id": owner_id_val}).first()
            if first_listing_res and first_listing_res[0]:
                import json as _json
                try:
                    imgs = _json.loads(first_listing_res[0]) if isinstance(first_listing_res[0], str) else first_listing_res[0]
                    cover_image = imgs[0] if imgs else None
                except Exception:
                    cover_image = first_listing_res[0]

            shops.append({
                "id": str(row[0]),
                "user_id": str(row[1]),
                "shop_name": row[2],
                "owner_name": row[3],
                "category": row[4],
                "shop_address": row[5],
                "location_lat": row[6],
                "location_lng": row[7],
                "rating": 4.5,
                "is_verified": True,
                "listing_count": row[11],
                "category_ids": cat_ids,
                "cover_image": cover_image,
                "slug": str(row[0]),
                "created_at": row[10].isoformat() if row[10] else None,
            })

        # Get total count (distinct by user_id to match the query above)
        count_query = text(f"""
            SELECT COUNT(DISTINCT s.user_id)
            FROM sellers s
            JOIN listing l ON l.status = 'active' AND CAST(l.owner_id AS TEXT) = s.user_id
            WHERE s.verification_status = 'verified'
            AND s.is_active = true
            {search_clause}
        """)
        total_res = db.execute(count_query, {k: v for k, v in params.items() if k not in ("skip", "limit")}).first()
        total = total_res[0] if total_res else len(shops)

        return {"total": total, "shops": shops}
    except Exception as e:
        print(f"Error in list_public_shops: {str(e)}")
        return {"total": 0, "shops": []}



@admin_router.get("/shops")
def list_shops(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get marketplace shops/sellers - only verified sellers with at least 1 listing"""
    try:
        from sqlalchemy import text, func

        # Use raw SQL to efficiently find sellers with listings, deduplicating by user_id
        # Filter only numeric user_ids to avoid CAST errors
        query = text("""
            SELECT DISTINCT ON (s.user_id) s.id, s.user_id, s.shop_name, s.owner_name, s.phone, s.email,
                   s.shop_address, s.location_lat, s.location_lng, s.created_at,
                   s.verification_status, s.is_active
            FROM sellers s
            INNER JOIN listing l ON CAST(s.user_id AS INTEGER) = l.owner_id
            WHERE s.is_active = true
            AND s.verification_status = 'verified'
            AND l.status = 'active'
            AND s.user_id ~ '^[0-9]+$'
            ORDER BY s.user_id, s.created_at DESC
            OFFSET :skip
            LIMIT :limit
        """)

        result = db.execute(query, {"skip": skip, "limit": limit})
        rows = result.fetchall()

        sellers = []
        for row in rows:
            sellers.append({
                "id": row[0],
                "user_id": row[1],
                "shop_name": row[2],
                "owner_name": row[3],
                "phone": row[4],
                "email": row[5],
                "shop_address": row[6],
                "location_lat": row[7],
                "location_lng": row[8],
                "rating": 5.0,
                "is_verified": row[10] == "verified",
                "created_at": row[9].isoformat() if row[9] else None
            })

        return sellers
    except Exception as e:
        return []


@listings_router.get("/{category_id}")
def get_category(
    category_id: int,
    db: Session = Depends(get_db)
):
    """Get category details"""
    try:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        return {
            "id": category.id,
            "name_en": category.name_en,
            "name_so": category.name_so,
            "slug": category.slug,
            "icon_name": category.icon_name,
            "image_url": category.image_url
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/duplicate-shops")
def find_duplicate_shops(db: Session = Depends(get_db)):
    """Find all users with multiple seller accounts"""
    try:
        from sqlalchemy import text

        query = text("""
            SELECT user_id, COUNT(*) as shop_count,
                   array_agg(id) as ids,
                   array_agg(shop_name) as shop_names,
                   array_agg(created_at) as created_dates
            FROM sellers
            WHERE is_active = true
            AND verification_status = 'verified'
            GROUP BY user_id
            HAVING COUNT(*) > 1
            ORDER BY shop_count DESC
        """)

        result = db.execute(query)
        rows = result.fetchall()

        duplicates = []
        for row in rows:
            duplicates.append({
                "user_id": row[0],
                "shop_count": row[1],
                "shop_ids": row[2],
                "shop_names": row[3],
                "created_dates": [d.isoformat() if d else None for d in row[4]]
            })

        return {
            "total_duplicate_users": len(duplicates),
            "duplicates": duplicates
        }
    except Exception as e:
        print(f"Error finding duplicates: {str(e)}")
        return {"total_duplicate_users": 0, "duplicates": []}


@admin_router.post("/merge-shops")
def merge_duplicate_shops(
    user_id: str,
    keep_shop_id: str = None,
    db: Session = Depends(get_db)
):
    """Merge duplicate shops for a user, keeping one and deactivating others"""
    try:
        from sqlalchemy import text

        # Get all shops for this user
        shops_query = text("SELECT id, created_at FROM sellers WHERE user_id = :user_id ORDER BY created_at DESC")
        result = db.execute(shops_query, {"user_id": user_id})
        shops = result.fetchall()

        if len(shops) <= 1:
            return {"message": "User has only one shop, no merge needed"}

        # Keep the newest one (first in ordered results) unless specified
        keeper_id = keep_shop_id or shops[0][0]

        # Deactivate all other shops
        for shop_id, _ in shops[1:]:
            if shop_id != keeper_id:
                update_query = text("UPDATE sellers SET is_active = false WHERE id = :id")
                db.execute(update_query, {"id": shop_id})

        db.commit()

        return {
            "message": f"Merged {len(shops) - 1} duplicate shops",
            "kept_shop_id": keeper_id,
            "deactivated_shop_ids": [s[0] for s in shops[1:] if s[0] != keeper_id]
        }
    except Exception as e:
        db.rollback()
        print(f"Error merging shops: {str(e)}")
        return {"error": str(e)}


@notifications_router.websocket("/ws")
async def websocket_notifications_endpoint(websocket: WebSocket, token: str = None):
    """WebSocket endpoint for real-time notifications"""
    try:
        await websocket.accept()
        await websocket.send_json({"type": "connection", "message": "Connected to notifications", "timestamp": datetime.utcnow().isoformat()})
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                await websocket.send_json({"type": "echo", "message": data, "timestamp": datetime.utcnow().isoformat()})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping", "message": "Ping", "timestamp": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
        except:
            pass
