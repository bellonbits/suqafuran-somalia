"""
Sellers API
===========
Sellers are NOT a separate database entity.
Any user who:
  1. has `is_verified = true`
  2. has `is_active = true`
  3. has at least one listing with status='active' AND moderation_status='approved'
…is automatically considered a seller.
"""

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlmodel import Session
from sqlalchemy import text
from app.api import deps
from app.models.user import User
from pydantic import BaseModel
import uuid
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)
from app.services.storage_service import storage_service

router = APIRouter()


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    business_name: Optional[str] = None
    shop_description: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    market: Optional[str] = None


@router.get("/")
def list_sellers(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(default=None, description="Search by name, business name, or email"),
    featured_only: bool = Query(default=False),
) -> Any:
    """
    List all sellers.
    A seller = a verified, active user with at least one approved active listing.
    No registration required — automatic qualification.
    """
    try:
        search_clause = ""
        featured_clause = ""
        params: dict = {"skip": skip, "limit": limit}

        if search:
            search_clause = """
                AND (
                    u.full_name ILIKE :search
                    OR u.business_name ILIKE :search
                    OR u.email ILIKE :search
                )
            """
            params["search"] = f"%{search}%"

        if featured_only:
            featured_clause = "AND u.is_featured = true"

        query = text(f"""
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.business_name,
                u.shop_description,
                u.shop_page_banner,
                u.avatar_url,
                u.is_verified,
                u.is_featured,
                u.free_delivery,
                u.verified_level,
                u.trust_score,
                u.trust_level,
                u.location,
                u.response_time,
                u.created_at,
                COUNT(DISTINCT l.id) AS listings_count
            FROM "user" u
            INNER JOIN listing l
                ON l.owner_id = u.id
                AND l.status = 'active'
                AND l.moderation_status = 'approved'
            WHERE u.is_verified = true
              AND u.is_active = true
              {search_clause}
              {featured_clause}
            GROUP BY u.id
            ORDER BY u.is_featured DESC, u.trust_score DESC, u.created_at DESC
            LIMIT :limit OFFSET :skip
        """)

        rows = db.execute(query, params).fetchall()

        return [
            {
                "id": row[0],
                "full_name": row[1],
                "email": row[2],
                "phone": row[3],
                "business_name": row[4] or row[1],
                "shop_description": row[5],
                "shop_page_banner": row[6],
                "avatar_url": row[7],
                "is_verified": bool(row[8]),
                "is_featured": bool(row[9]),
                "free_delivery": bool(row[10]),
                "verified_level": row[11],
                "trust_score": row[12] or 0,
                "trust_level": row[13] or "NEW",
                "location": row[14],
                "response_time": row[15] or "Typically responds in a few hours",
                "created_at": str(row[16]),
                "listings_count": int(row[17]),
            }
            for row in rows
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error listing sellers: {str(e)}")


@router.get("/me")
def get_current_seller(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the current authenticated user's seller profile.
    """
    from sqlalchemy import func
    from app.models.listing import Listing

    listings_count = db.query(func.count(Listing.id)).filter(
        Listing.owner_id == current_user.id,
        Listing.status == "active",
        Listing.moderation_status == "approved"
    ).scalar() or 0

    return {
        "id": current_user.id,
        "user_id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": getattr(current_user, "phone", None),
        "business_name": getattr(current_user, "business_name", None) or current_user.full_name,
        "shop_description": getattr(current_user, "shop_description", None),
        "shop_page_banner": getattr(current_user, "shop_page_banner", None),
        "shop_detail_banner": getattr(current_user, "shop_detail_banner", None),
        "avatar_url": getattr(current_user, "avatar_url", None),
        "logo_url": getattr(current_user, "logo_url", None),
        "is_verified": getattr(current_user, "is_verified", False),
        "is_featured": getattr(current_user, "is_featured", False),
        "free_delivery": getattr(current_user, "free_delivery", False),
        "verified_level": getattr(current_user, "verified_level", None),
        "trust_score": getattr(current_user, "trust_score", 0) or 0,
        "trust_level": getattr(current_user, "trust_level", "NEW") or "NEW",
        "location": getattr(current_user, "location", None),
        "response_time": getattr(current_user, "response_time", "Typically responds in a few hours") or "Typically responds in a few hours",
        "created_at": str(getattr(current_user, "created_at", "")),
        "listings_count": listings_count,
    }


@router.get("/count")
def count_sellers(
    db: Session = Depends(deps.get_db),
    search: Optional[str] = Query(default=None),
) -> Any:
    """Count of all qualified sellers (for pagination)."""
    try:
        search_clause = ""
        params: dict = {}

        if search:
            search_clause = """
                AND (
                    u.full_name ILIKE :search
                    OR u.business_name ILIKE :search
                    OR u.email ILIKE :search
                )
            """
            params["search"] = f"%{search}%"

        query = text(f"""
            SELECT COUNT(DISTINCT u.id)
            FROM "user" u
            INNER JOIN listing l
                ON l.owner_id = u.id
                AND l.status = 'active'
                AND l.moderation_status = 'approved'
            WHERE u.is_verified = true
              AND u.is_active = true
              {search_clause}
        """)

        total = db.execute(query, params).scalar() or 0
        return {"total": int(total)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{seller_id}")
def get_seller(
    seller_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get a single seller's public profile by user ID.
    Returns 404 if the user is not a qualified seller
    (not verified, or no active approved listings).
    """
    try:
        query = text("""
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.business_name,
                u.shop_description,
                u.shop_page_banner,
                u.shop_detail_banner,
                u.avatar_url,
                u.logo_url,
                u.is_verified,
                u.is_featured,
                u.free_delivery,
                u.verified_level,
                u.trust_score,
                u.trust_level,
                u.location,
                u.response_time,
                u.created_at,
                COALESCE(COUNT(DISTINCT l.id), 0) AS listings_count
            FROM "user" u
            LEFT JOIN listing l
                ON l.owner_id = u.id
                AND l.status = 'active'
                AND l.moderation_status = 'approved'
            WHERE u.id = :seller_id
              AND u.is_active = true
            GROUP BY u.id
        """)

        row = db.execute(query, {"seller_id": seller_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Seller not found")

        return {
            "id": row[0],
            "full_name": row[1],
            "email": row[2],
            "phone": row[3],
            "business_name": row[4] or row[1],
            "shop_description": row[5],
            "shop_page_banner": row[6],
            "shop_detail_banner": row[7],
            "avatar_url": row[8],
            "logo_url": row[9],
            "is_verified": bool(row[10]),
            "is_featured": bool(row[11]),
            "free_delivery": bool(row[12]),
            "verified_level": row[13],
            "trust_score": row[14] or 0,
            "trust_level": row[15] or "NEW",
            "location": row[16],
            "response_time": row[17] or "Typically responds in a few hours",
            "created_at": str(row[18]),
            "listings_count": int(row[19]),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{seller_id}/is-seller")
def check_is_seller(
    seller_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Quick check: returns whether a given user qualifies as a seller.
    Used by the frontend to conditionally show seller UI.
    """
    try:
        query = text("""
            SELECT 1
            FROM "user" u
            INNER JOIN listing l
                ON l.owner_id = u.id
                AND l.status = 'active'
                AND l.moderation_status = 'approved'
            WHERE u.id = :seller_id
              AND u.is_verified = true
              AND u.is_active = true
            LIMIT 1
        """)
        result = db.execute(query, {"seller_id": seller_id}).fetchone()
        return {"is_seller": result is not None, "user_id": seller_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/me")
def update_current_seller_profile(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    profile_update: ProfileUpdate,
) -> Any:
    """
    Update the current seller's profile information.
    Allows updating name, business name, shop description, location, etc.
    """
    # Track if this is a new shop creation
    is_new_shop = not current_user.business_name and profile_update.business_name

    # Check phone uniqueness if changing
    if profile_update.phone is not None and profile_update.phone != current_user.phone:
        existing_phone = crud_user.get_user_by_phone(db, phone=profile_update.phone, exclude_user_id=current_user.id)
        if existing_phone:
            raise HTTPException(status_code=400, detail="This phone number is already registered to another account.")
        cleaned_phone = crud_user.normalize_phone(profile_update.phone)
        current_user.phone = cleaned_phone or profile_update.phone

    # Check business name uniqueness if changing
    if profile_update.business_name is not None and profile_update.business_name != current_user.business_name:
        existing_biz = crud_user.get_user_by_business_name(db, business_name=profile_update.business_name, exclude_user_id=current_user.id)
        if existing_biz:
            raise HTTPException(status_code=400, detail="A shop or business with this name already exists. Please choose a unique name.")
        current_user.business_name = profile_update.business_name

    # Update allowed fields
    if profile_update.full_name is not None:
        current_user.full_name = profile_update.full_name
    if profile_update.shop_description is not None:
        current_user.shop_description = profile_update.shop_description
    if profile_update.location is not None:
        current_user.location = profile_update.location
    if profile_update.market is not None:
        current_user.market = profile_update.market

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    # Send shop creation email if this is a new shop
    if is_new_shop:
        try:
            from app.services.marketing_service import marketing_service
            from app.models.marketing import EmailEventType
            import asyncio

            asyncio.run(marketing_service.send_event_email(
                session=db,
                user_id=current_user.id,
                event_type=EmailEventType.SHOP_CREATED,
                context={
                    "first_name": current_user.full_name.split()[0] if current_user.full_name else "Seller",
                    "shop_name": profile_update.business_name or "Your Shop",
                    "shop_link": f"{profile_update.location}/shops/{current_user.id}" if hasattr(profile_update, '__dict__') else "/shops",
                    "add_products_link": "/dashboard/listings/create",
                    "help_link": "/help/create-shop"
                }
            ))
        except Exception as e:
            logger.warning(f"Failed to send shop creation email: {e}")

    return {
        "status": "updated",
        "id": current_user.id,
        "full_name": current_user.full_name,
        "business_name": current_user.business_name,
        "phone": current_user.phone,
        "location": current_user.location,
        "market": current_user.market,
        "shop_description": current_user.shop_description,
        "message": "Profile updated successfully"
    }


@router.post("/me/logo")
async def upload_seller_logo(
    *,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload a shop logo for the current seller.
    Logo will be displayed on the shop card in the /shops page.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    extension = file.filename.split(".")[-1].lower()
    if extension not in ["jpg", "jpeg", "png", "gif", "webp"]:
        raise HTTPException(status_code=400, detail="Only image files are allowed (jpg, png, gif, webp)")

    contents = await file.read(5 * 1024 * 1024 + 1)  # 5MB limit
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    filename = f"logo_{current_user.id}_{uuid.uuid4()}.{extension}"

    try:
        url, _ = await storage_service.upload_file(contents, filename)
        current_user.logo_url = url
        db.add(current_user)
        db.commit()
        db.refresh(current_user)

        return {
            "status": "success",
            "logo_url": url,
            "message": "Logo uploaded successfully"
        }
    except Exception as e:
        import logging
        logging.getLogger("sellers_api").error(f"Failed to upload logo: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload logo: {str(e)}")
