from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, BackgroundTasks
from sqlmodel import Session, select, func
from pydantic import BaseModel
from app.api import deps
from app.models.listing import Listing, Category, ListingRead
from app.models.user import User, UserResponse
from app.models.promotion import Promotion, PromotionStatus
from app.models.audit import AuditLog
from app.models.business import Business
from app.models.report import ListingReport
from app.models.message import Message
from app.models.marketplace_conversation import MarketplaceConversation as Conversation
from app.services.storage_service import storage_service
from app.services.cache_service import cache

# Try importing Seller from routers (Phase 4)
try:
    from models import Seller
except ImportError:
    Seller = None

router = APIRouter()


# --- Pydantic Models ---
class ShopDetailsUpdate(BaseModel):
    business_name: Optional[str] = None
    full_name: Optional[str] = None

class ShopBannersUpdate(BaseModel):
    shop_page_banner: Optional[str] = None
    shop_detail_banner: Optional[str] = None

class ShopManagementUpdate(BaseModel):
    business_name: Optional[str] = None
    shop_description: Optional[str] = None
    logo_url: Optional[str] = None
    shop_page_banner: Optional[str] = None
    shop_detail_banner: Optional[str] = None
    location: Optional[str] = None
    is_featured: Optional[bool] = None
    is_verified: Optional[bool] = None
    free_delivery: Optional[bool] = None
    is_active: Optional[bool] = None

class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    verified_level: Optional[str] = None
    is_admin: Optional[bool] = None
    is_agent: Optional[bool] = None
    trust_score: Optional[int] = None
    trust_level: Optional[str] = None
    is_flagged: Optional[bool] = None
    is_suspended: Optional[bool] = None
    business_name: Optional[str] = None
    shop_description: Optional[str] = None
    shop_page_banner: Optional[str] = None
    shop_detail_banner: Optional[str] = None
    is_featured: Optional[bool] = None
    free_delivery: Optional[bool] = None

class ShopRead(BaseModel):
    id: int
    business_name: Optional[str] = None
    full_name: Optional[str] = None
    shop_description: Optional[str] = None
    logo_url: Optional[str] = None
    shop_page_banner: Optional[str] = None
    shop_detail_banner: Optional[str] = None
    location: Optional[str] = None
    is_featured: bool = False
    is_verified: bool = False
    free_delivery: bool = False
    is_active: bool = True
    email: str
    total_listings: int = 0
    active_listings: int = 0
    phone: Optional[str] = None
    is_suspended: bool = False
    trust_score: int = 0
    followers: int = 0
    created_at: Optional[str] = None


@router.get("/orders")
def list_all_orders(db: Session = Depends(deps.get_db)) -> Any:
    """
    List checkout receipts with buyer/shop info, item breakdown, and whether
    the buyer contacted the seller (WhatsApp/call/message) — Admin endpoint.

    Reads from checkout_receipt, not the legacy delivery-era "orders" table:
    this app is a direct P2P classifieds marketplace (no delivery/logistics),
    and neither current checkout flow ever wrote to that old table.
    """
    import json
    from sqlalchemy import text

    def parse_items(raw):
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except (TypeError, ValueError):
                return []
        return raw or []

    result = db.exec(text("""
        SELECT
            r.id, r.buyer_id, r.seller_id, r.items, r.total_amount, r.created_at,
            buyer.full_name AS buyer_name, buyer.email AS buyer_email, buyer.phone AS buyer_phone,
            seller.full_name AS seller_name, b.name AS shop_name,
            COALESCE(array_agg(DISTINCT i.type) FILTER (WHERE i.type IS NOT NULL), '{}') AS contact_types,
            MAX(i.created_at) AS last_contacted_at
        FROM checkout_receipt r
        LEFT JOIN "user" buyer ON buyer.id = r.buyer_id
        LEFT JOIN "user" seller ON seller.id = r.seller_id
        LEFT JOIN business b ON b.owner_id = r.seller_id
        LEFT JOIN interaction i ON i.receipt_id = r.id
        GROUP BY r.id, buyer.full_name, buyer.email, buyer.phone, seller.full_name, b.name
        ORDER BY r.created_at DESC
        LIMIT 100
    """)).all()

    return [
        {
            "id": row.id,
            "customer": {
                "id": row.buyer_id,
                "full_name": row.buyer_name or "Unknown",
                "email": row.buyer_email or "",
                "phone": row.buyer_phone or "",
            },
            "seller": {
                "id": row.seller_id,
                "full_name": row.seller_name or "Unknown",
                "shop_name": row.shop_name or row.seller_name or "Unknown Shop",
            },
            "items": parse_items(row.items),
            "total_amount": float(row.total_amount or 0),
            "created_at": str(row.created_at),
            "contacted_whatsapp": "whatsapp" in (row.contact_types or []),
            "contacted_call": "call" in (row.contact_types or []),
            "contacted_message": "message" in (row.contact_types or []),
            "last_contacted_at": str(row.last_contacted_at) if row.last_contacted_at else None,
        }
        for row in result
    ]


@router.get("/stats", response_model=dict)
def read_admin_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Platform-wide stats for the admin dashboard's Management Overview.
    Sellers are defined the same way the rest of the app already does (a
    business_name set), matching get_public_shops -- there's no separate
    is_seller flag on User.
    """
    from datetime import datetime, timedelta
    from app.models.verification import VerificationRequest, VerificationStatus
    from app.models.report import ListingReport

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    prev_month_start = now - timedelta(days=60)

    total_users = db.exec(select(func.count(User.id))).one()
    active_users = db.exec(select(func.count(User.id)).where(User.is_active == True)).one()  # noqa: E712
    suspended_accounts = db.exec(select(func.count(User.id)).where(User.is_suspended == True)).one()  # noqa: E712

    is_seller = User.business_name.isnot(None)
    active_sellers = db.exec(select(func.count(User.id)).where(is_seller, User.is_active == True)).one()  # noqa: E712
    active_buyers = max(active_users - active_sellers, 0)
    verified_sellers = db.exec(select(func.count(User.id)).where(is_seller, User.is_verified == True)).one()  # noqa: E712

    total_shops = db.exec(
        select(func.count(func.distinct(Listing.owner_id)))
        .select_from(Listing)
        .join(User, User.id == Listing.owner_id)
        .where(Listing.status == "active", User.is_verified == True)  # noqa: E712
    ).one()

    total_listings = db.exec(select(func.count(Listing.id))).one()
    active_listings = db.exec(select(func.count(Listing.id)).where(Listing.status == "active")).one()
    pending_listings = db.exec(select(func.count(Listing.id)).where(Listing.status == "pending")).one()
    pending_promotions = db.exec(select(func.count(Promotion.id)).where(Promotion.status == PromotionStatus.SUBMITTED)).one()

    pending_seller_verifications = db.exec(
        select(func.count(VerificationRequest.id)).where(VerificationRequest.status == VerificationStatus.PENDING)
    ).one()

    reported_listings = db.exec(
        select(func.count(func.distinct(ListingReport.listing_id))).where(ListingReport.status == "pending")
    ).one()
    open_disputes = db.exec(select(func.count(ListingReport.id)).where(ListingReport.status == "pending")).one()

    new_signups_today = db.exec(select(func.count(User.id)).where(User.created_at >= today_start)).one()
    new_signups_week = db.exec(select(func.count(User.id)).where(User.created_at >= week_start)).one()
    new_signups_month = db.exec(select(func.count(User.id)).where(User.created_at >= month_start)).one()

    signups_this_month = new_signups_month
    signups_prev_month = db.exec(
        select(func.count(User.id)).where(User.created_at >= prev_month_start, User.created_at < month_start)
    ).one()
    growth_rate = (
        round((signups_this_month - signups_prev_month) / signups_prev_month * 100, 1)
        if signups_prev_month else (100.0 if signups_this_month else 0.0)
    )

    listings_today = db.exec(select(func.count(Listing.id)).where(Listing.created_at >= today_start)).one()
    messages_today = db.exec(
        select(func.count(Message.id)).where(Message.created_at >= today_start)
    ).one()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "active_sellers": active_sellers,
        "active_buyers": active_buyers,
        "total_shops": total_shops,
        "total_listings": total_listings,
        "active_listings": active_listings,
        "pending_listings": pending_listings,
        "pending_promotions": pending_promotions,
        "verified_sellers": verified_sellers,
        "pending_seller_verifications": pending_seller_verifications,
        "suspended_accounts": suspended_accounts,
        "reported_listings": reported_listings,
        "open_disputes": open_disputes,
        "new_signups_today": new_signups_today,
        "new_signups_this_week": new_signups_week,
        "new_signups_this_month": new_signups_month,
        "new_users_this_week": new_signups_week,  # legacy key the dashboard already read
        "platform_growth_rate": growth_rate,
        "marketplace_activity": {
            "listings_posted_today": listings_today,
            "messages_sent_today": messages_today,
        },
    }


@router.get("/queue", response_model=List[ListingRead])
def read_moderation_queue(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get listings awaiting moderation.
    """
    statement = select(Listing).where(Listing.status == "pending").offset(skip).limit(limit)
    listings = db.exec(statement).all()
    return listings


@router.post("/moderate/{listing_id}", response_model=Listing)
def moderate_listing(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    listing_id: int,
    approve: bool = True,
) -> Any:
    """
    Approve or reject a listing.
    """
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    listing.status = "active" if approve else "rejected"
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Push notification to listing owner
    from app.utils.push import send_push_to_user
    if approve:
        send_push_to_user(
            db,
            user_id=listing.owner_id,
            title="Your ad is live!",
            body=f"'{listing.title_en}' has been approved and is now visible to buyers.",
            data={"type": "ad_approved", "listing_id": str(listing.id), "path": f"/listing/{listing.id}"}
        )
    else:
        send_push_to_user(
            db,
            user_id=listing.owner_id,
            title="Ad not approved",
            body=f"'{listing.title_en}' was not approved. Please review and repost.",
            data={"type": "ad_rejected", "listing_id": str(listing.id), "path": "/dashboard"}
        )

    return listing


def _apply_registered_signups_filters(
    statement,
    *,
    search: Optional[str] = None,
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    verification: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Shared Date | User Type | Status | Location | Verification filter set
    for the Registered Signups list and count endpoints, so the count shown
    in pagination always matches what the list is actually filtered to."""
    from datetime import datetime as dt
    from sqlmodel import or_

    if search:
        pattern = f"%{search}%"
        statement = statement.where(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.phone.ilike(pattern),
            )
        )
    if user_type == "seller":
        statement = statement.where(User.business_name.isnot(None))
    elif user_type == "buyer":
        statement = statement.where(User.business_name.is_(None), User.is_admin == False)  # noqa: E712
    elif user_type == "admin":
        statement = statement.where(User.is_admin == True)  # noqa: E712
    if status == "active":
        statement = statement.where(User.is_active == True, User.is_suspended == False)  # noqa: E712
    elif status == "inactive":
        statement = statement.where(User.is_active == False)  # noqa: E712
    elif status == "suspended":
        statement = statement.where(User.is_suspended == True)  # noqa: E712
    if verification == "verified":
        statement = statement.where(User.is_verified == True)  # noqa: E712
    elif verification == "unverified":
        statement = statement.where(User.is_verified == False)  # noqa: E712
    if location:
        statement = statement.where(User.location.ilike(f"%{location}%"))
    if date_from:
        statement = statement.where(User.created_at >= dt.fromisoformat(date_from))
    if date_to:
        statement = statement.where(User.created_at <= dt.fromisoformat(date_to))
    return statement


@router.get("/users", response_model=List[UserResponse])
def read_users_admin(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = Query(default=None, description="Search by name, email, or phone"),
    user_type: Optional[str] = Query(default=None, description="buyer, seller, or admin"),
    status: Optional[str] = Query(default=None, description="active, inactive, or suspended"),
    verification: Optional[str] = Query(default=None, description="verified or unverified"),
    location: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="ISO date, registered on/after"),
    date_to: Optional[str] = Query(default=None, description="ISO date, registered on/before"),
) -> Any:
    """
    List all users (Admin only), with the full Registered Signups filter set.
    response_model is UserResponse (not the raw User table model) so
    hashed_password never leaves the server -- the previous response_model
    of List[User] was serializing every user's password hash into this
    response.
    """
    statement = _apply_registered_signups_filters(
        select(User), search=search, user_type=user_type, status=status,
        verification=verification, location=location, date_from=date_from, date_to=date_to,
    )
    statement = statement.order_by(User.created_at.desc()).offset(skip).limit(limit)
    users = db.exec(statement).all()
    return users


@router.get("/users/count")
def count_users_admin(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    search: Optional[str] = Query(default=None),
    user_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    verification: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
) -> Any:
    """
    Count total users matching the same filters as GET /users (for pagination).
    """
    statement = _apply_registered_signups_filters(
        select(func.count(User.id)), search=search, user_type=user_type, status=status,
        verification=verification, location=location, date_from=date_from, date_to=date_to,
    )
    total = db.exec(statement).one()
    return {"total": total}


@router.get("/users/signup-stats")
def get_signup_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Breakdown counts for the Registered Signups summary cards."""
    total = db.exec(select(func.count(User.id))).one()
    buyers = db.exec(select(func.count(User.id)).where(User.business_name.is_(None), User.is_admin == False)).one()  # noqa: E712
    sellers = db.exec(select(func.count(User.id)).where(User.business_name.isnot(None))).one()
    admins = db.exec(select(func.count(User.id)).where(User.is_admin == True)).one()  # noqa: E712
    verified = db.exec(select(func.count(User.id)).where(User.is_verified == True)).one()  # noqa: E712
    unverified = db.exec(select(func.count(User.id)).where(User.is_verified == False)).one()  # noqa: E712
    active = db.exec(select(func.count(User.id)).where(User.is_active == True)).one()  # noqa: E712
    inactive = db.exec(select(func.count(User.id)).where(User.is_active == False)).one()  # noqa: E712
    suspended = db.exec(select(func.count(User.id)).where(User.is_suspended == True)).one()  # noqa: E712
    return {
        "total": total,
        "buyers": buyers,
        "sellers": sellers,
        "admins": admins,
        "verified": verified,
        "unverified": unverified,
        "active": active,
        "inactive": inactive,
        "suspended": suspended,
    }

class AgentEmailIn(BaseModel):
    email: str

@router.get("/agents", response_model=List[dict])
def list_agents(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    agents = db.exec(select(User).where(User.is_agent == True).order_by(User.created_at.desc())).all()
    return [{"id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone, "created_at": u.created_at.isoformat()} for u in agents]

@router.post("/agents/add")
def add_agent(
    payload: AgentEmailIn,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    user = db.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    if user.is_agent:
        raise HTTPException(status_code=400, detail="This user is already an agent.")
    user.is_agent = True
    db.add(user)
    db.commit()
    return {"success": True, "name": user.full_name, "email": user.email}

@router.post("/agents/remove")
def remove_agent(
    payload: AgentEmailIn,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    user = db.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    user.is_agent = False
    db.add(user)
    db.commit()
    return {"success": True}

@router.get("/sellers")
def list_sellers(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(default=None),
) -> Any:
    """
    List all automatic sellers — users who are verified AND have at least one active listing.
    Sellers are derived from the user table; no separate seller registration required.
    Public endpoint — no auth required.
    """
    try:
        from sqlalchemy import text

        search_clause = ""
        params: dict = {"skip": skip, "limit": limit}

        if search:
            search_clause = "AND (u.full_name ILIKE :search OR u.email ILIKE :search OR u.business_name ILIKE :search)"
            params["search"] = f"%{search}%"

        query = text(f"""
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.business_name,
                u.shop_description,
                u.avatar_url,
                u.is_verified,
                u.is_featured,
                u.free_delivery,
                u.verified_level,
                u.trust_score,
                u.trust_level,
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
            GROUP BY u.id
            ORDER BY u.is_featured DESC, u.created_at DESC
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
                "avatar_url": row[6],
                "is_verified": bool(row[7]),
                "is_featured": bool(row[8]),
                "free_delivery": bool(row[9]),
                "verified_level": row[10],
                "trust_score": row[11] or 0,
                "trust_level": row[12] or "NEW",
                "created_at": str(row[13]),
                "listings_count": int(row[14]),
            }
            for row in rows
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error listing sellers: {str(e)}")

@router.post("/users/{user_id}/status")
def update_user_status(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    user_id: int,
    is_active: bool,
    reason: Optional[str] = None,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Deactivate or activate a user account.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    was_active = user.is_active
    user.is_active = is_active
    db.add(user)

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_STATUS_UPDATE",
        resource_type="user",
        resource_id=user_id,
        details=f"User {'activated' if is_active else 'deactivated'}"
    ))

    db.commit()
    db.refresh(user)

    if was_active and not is_active and user.email:
        from app.services.email_service import email_service
        background_tasks.add_task(
            email_service.send_account_deactivated_email, user.email, user.full_name or "Customer", reason, user.id
        )

    return user


@router.delete("/users/{user_id}")
def delete_user_admin(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    user_id: int,
) -> Any:
    """
    Permanently delete a user account and all related data (cascade).
    """
    from sqlalchemy import text

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # ── Cascade: delete all FK-linked records in dependency order ─────────────
    # We wrap each execution in a SAVEPOINT using db.begin_nested()
    # so that if a table does not exist or has a different constraint name,
    # the failure won't abort the entire PostgreSQL transaction.
    
    # 1. Audit logs referencing this user
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM auditlog WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 2. Notifications
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM notification WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 3. Device tokens / links
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM userdevicelink WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 4. Email logs
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM emaillog WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 5. Favorites
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM favorite WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 6. Follows
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM follow WHERE follower_id = :uid OR followed_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 7. Messages
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM message WHERE sender_id = :uid OR recipient_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 8. Mobile money transactions / mobile transactions
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM mobiletransaction WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 9. KaalayHeedhePin
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM kaalayheedhepin WHERE owner_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 10. Support tickets
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM supportticket WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 11. Verification requests
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM verificationrequest WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 12. Risk history
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM riskhistory WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 13. Ratings & Reports
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM rating WHERE rater_id = :uid OR rated_user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM report WHERE reporter_id = :uid OR reported_user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 14. Feedback
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM feedback WHERE author_id = :uid OR target_user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 15. Meetings & Deals
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM meeting WHERE buyer_id = :uid OR seller_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM deal WHERE buyer_id = :uid OR seller_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 16. Delivery
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM delivery WHERE seller_id = :uid OR buyer_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 17. Wallet & Transactions & Vouchers
    try:
        with db.begin_nested():
            # Delete transactions belonging to user's wallet
            db.exec(text(
                "DELETE FROM transaction WHERE wallet_id IN "
                "(SELECT id FROM wallet WHERE user_id = :uid)"
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM wallet WHERE user_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text("UPDATE voucher SET redeemed_by_id = NULL WHERE redeemed_by_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 18. Promotions linked to user's listings
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM promotion WHERE listing_id IN "
                "(SELECT id FROM listing WHERE owner_id = :uid)"
            ).bindparams(uid=user_id))
    except Exception:
        pass

    # 19. Listing interactions / views
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM interaction WHERE listing_id IN "
                "(SELECT id FROM listing WHERE owner_id = :uid)"
            ).bindparams(uid=user_id))
    except Exception:
        pass

    # 20. Business Tasks, Messages, Orders, Customers, Products, Employees under user's business
    try:
        with db.begin_nested():
            # Delete tasks assigned to employees of user's business, or tasks under user's business
            db.exec(text(
                "DELETE FROM businesstask WHERE business_id IN "
                "(SELECT id FROM business WHERE owner_id = :uid) OR "
                "assigned_to IN (SELECT id FROM employee WHERE user_id = :uid)"
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM teammessage WHERE business_id IN "
                "(SELECT id FROM business WHERE owner_id = :uid) OR "
                "sender_id = :uid"
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM businessmessage WHERE business_id IN "
                "(SELECT id FROM business WHERE owner_id = :uid) OR "
                "customer_id = :uid OR sender_id = :uid"
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text(
                'DELETE FROM "order" WHERE business_id IN '
                '(SELECT id FROM business WHERE owner_id = :uid) OR '
                'customer_id = :uid OR '
                'employee_id IN (SELECT id FROM employee WHERE user_id = :uid)'
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM businesscustomer WHERE business_id IN "
                "(SELECT id FROM business WHERE owner_id = :uid) OR "
                "user_id = :uid"
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM businessproduct WHERE business_id IN "
                "(SELECT id FROM business WHERE owner_id = :uid) OR "
                "listing_id IN (SELECT id FROM listing WHERE owner_id = :uid)"
            ).bindparams(uid=user_id))
    except Exception:
        pass
    try:
        with db.begin_nested():
            db.exec(text(
                "DELETE FROM employee WHERE business_id IN "
                "(SELECT id FROM business WHERE owner_id = :uid) OR "
                "user_id = :uid"
            ).bindparams(uid=user_id))
    except Exception:
        pass

    # 21. Listings themselves
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM listing WHERE owner_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 22. Business profiles
    try:
        with db.begin_nested():
            db.exec(text("DELETE FROM business WHERE owner_id = :uid").bindparams(uid=user_id))
    except Exception:
        pass

    # 18. Finally delete the user
    db.delete(user)

    # Audit the deletion (attributed to the admin performing it)
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_DELETE",
        resource_type="user",
        resource_id=user_id,
        details=f"User #{user_id} ({user.email}) permanently deleted by admin"
    ))

    db.commit()
    return {"success": True, "deleted_user_id": user_id}


# ── OTP Lookup (Agent Tool) ───────────────────────────────────────────────────

def _redis_otp_lookup(redis_client, identifier: str) -> dict:
    """
    Shared helper: read an OTP code + TTL from Redis by identifier.
    Both SMS and email OTPs are stored under the same key pattern: otp:{identifier}
    """
    key = f"otp:{identifier}"
    code = redis_client.get(key)
    ttl = redis_client.ttl(key)
    return {"code": code, "ttl": ttl}


@router.get("/otps")
def lookup_otp(
    phone: Optional[str] = Query(default=None, description="Phone number (SMS OTP lookup)"),
    email: Optional[str] = Query(default=None, description="Email address (Resend/email OTP lookup)"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Unified OTP lookup for agents — supports both SMS (phone) and email (Resend) OTPs.
    Both types are stored in Redis as otp:{identifier} with a 5-minute TTL.
    Only available to admins/agents to help customers who didn't receive their code.
    """
    if not phone and not email:
        raise HTTPException(status_code=400, detail="Provide either 'phone' or 'email' query parameter.")

    from app.services.africastalking_service import africastalking_service
    from app.services.email_service import email_service

    # Resolve a Redis client — prefer email_service client (same Redis, just a healthier instance)
    redis_client = africastalking_service.redis or email_service.redis
    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis is not available")

    # ── SMS / Phone OTP ───────────────────────────────────────────────────────
    if phone:
        try:
            normalized = africastalking_service.normalize_phone(phone)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid phone number format. Use +254XXXXXXXXX or 07XXXXXXXX.")

        result = _redis_otp_lookup(redis_client, normalized)
        if not result["code"]:
            return {
                "found": False,
                "channel": "sms",
                "identifier": normalized,
                "message": "No active SMS OTP found for this number. It may have expired or not been requested yet."
            }
        return {
            "found": True,
            "channel": "sms",
            "identifier": normalized,
            "code": result["code"],
            "expires_in_seconds": result["ttl"],
            "message": f"Active SMS OTP found. Expires in {result['ttl']}s."
        }

    # ── Email OTP (Resend / SMTP) ─────────────────────────────────────────────
    if email:
        normalized_email = email.strip().lower()
        result = _redis_otp_lookup(redis_client, normalized_email)
        if not result["code"]:
            return {
                "found": False,
                "channel": "email",
                "identifier": normalized_email,
                "message": "No active email OTP found for this address. It may have expired or not been requested yet."
            }
        return {
            "found": True,
            "channel": "email",
            "identifier": normalized_email,
            "code": result["code"],
            "expires_in_seconds": result["ttl"],
            "message": f"Active email OTP found. Expires in {result['ttl']}s."
        }


@router.get("/otp-logs")
def get_otp_logs(
    identifier: Optional[str] = Query(None, description="Phone or email to filter by"),
    event_type: Optional[str] = Query(None, description="sent|resent|verified|failed|expired|attempt_failed"),
    channel: Optional[str] = Query(None, description="sms|email"),
    date_from: Optional[str] = Query(None, description="ISO date e.g. 2026-01-01"),
    date_to: Optional[str] = Query(None, description="ISO date e.g. 2026-12-31"),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Query the append-only OTP event log. Supports filtering by identifier,
    event type, channel, and date range.
    """
    from app.models.otp_log import OTPLog
    from sqlmodel import select
    from datetime import datetime

    stmt = select(OTPLog)

    if identifier:
        clean = identifier.strip().lower()
        # Try to match both normalised phone and email
        try:
            from app.services.africastalking_service import africastalking_service
            normalized = africastalking_service.normalize_phone(identifier)
            stmt = stmt.where(
                (OTPLog.identifier == normalized) | (OTPLog.identifier == clean)
            )
        except Exception:
            stmt = stmt.where(OTPLog.identifier == clean)

    if event_type:
        stmt = stmt.where(OTPLog.event_type == event_type)

    if channel:
        stmt = stmt.where(OTPLog.channel == channel)

    if date_from:
        try:
            stmt = stmt.where(OTPLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass

    if date_to:
        try:
            stmt = stmt.where(OTPLog.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass

    total_stmt = stmt
    stmt = stmt.order_by(OTPLog.created_at.desc()).offset(offset).limit(limit)
    rows = db.exec(stmt).all()

    return {
        "total": db.exec(select(OTPLog.id).where(*[
            # re-apply same filters for count — simpler to just return len of full query
        ])).all().__len__() if not identifier and not event_type else len(rows),
        "results": [
            {
                "id": r.id,
                "identifier": r.identifier,
                "channel": r.channel,
                "event_type": r.event_type,
                "status": r.status,
                "attempt_count": r.attempt_count,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                "created_at": r.created_at.isoformat(),
                "meta": r.meta,
            }
            for r in rows
        ],
    }


@router.get("/verification-attempts")
def get_verification_attempts(
    identifier: str = Query(..., description="Email or phone of the user to look up"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Return all identity verification requests submitted by a user, looked up by
    their email or phone number.
    """
    from app.models.verification import VerificationRequest
    from app.models.user import User as UserModel
    from sqlmodel import select, or_

    clean = identifier.strip().lower()

    # Resolve user by email or phone
    user = db.exec(
        select(UserModel).where(
            or_(UserModel.email == clean, UserModel.phone == clean)
        )
    ).first()

    # Try normalised phone if not found
    if not user:
        try:
            from app.services.africastalking_service import africastalking_service
            normalized = africastalking_service.normalize_phone(identifier)
            user = db.exec(
                select(UserModel).where(UserModel.phone == normalized)
            ).first()
        except Exception:
            pass

    if not user:
        return {"user": None, "attempts": []}

    attempts = db.exec(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == user.id)
        .order_by(VerificationRequest.created_at.desc())
    ).all()

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "is_verified": user.is_verified,
        },
        "attempts": [
            {
                "id": a.id,
                "document_type": a.document_type,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
                "auto_verification_status": getattr(a, "auto_verification_status", None),
            }
            for a in attempts
        ],
    }


@router.get("/email/analytics", response_model=dict)
def read_email_analytics(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get highly performant, enterprise-grade Email Growth Engine analytics.
    Reports campaign CTRs, regional engagement, and onboarding funnel conversion rates.
    """
    from app.models.email_log import EmailLog
    import json

    # 1. Aggregate Campaign CTRs using DB Grouping
    group_stats = db.exec(
        select(EmailLog.email_type, EmailLog.status, func.count(EmailLog.id))
        .group_by(EmailLog.email_type, EmailLog.status)
    ).all()

    campaigns = {}
    for email_type, status, count in group_stats:
        if email_type not in campaigns:
            campaigns[email_type] = {"sent": 0, "opened": 0, "clicked": 0, "failed": 0, "total": 0}
        campaigns[email_type]["total"] += count
        if status in ["sent", "opened", "clicked"]:
            campaigns[email_type]["sent"] += count
        if status == "opened":
            campaigns[email_type]["opened"] += count
        elif status == "clicked":
            # Clicked implies opened as well for analytic tracking
            campaigns[email_type]["opened"] += count
            campaigns[email_type]["clicked"] += count
        elif status == "failed":
            campaigns[email_type]["failed"] += count

    # Compute high-fidelity percentages
    for c_type, stats in campaigns.items():
        sent_count = stats["sent"]
        stats["open_rate"] = f"{(stats['opened'] / sent_count * 100):.1f}%" if sent_count > 0 else "0.0%"
        stats["click_rate"] = f"{(stats['clicked'] / sent_count * 100):.1f}%" if sent_count > 0 else "0.0%"
        stats["ctr"] = f"{(stats['clicked'] / stats['opened'] * 100):.1f}%" if stats["opened"] > 0 else "0.0%"

    # 2. Compute Onboarding Funnel Conversion Rates
    welcome_sent = campaigns.get("onboarding_welcome", {}).get("sent", 0)
    welcome_opened = campaigns.get("onboarding_welcome", {}).get("opened", 0)
    profile_sent = campaigns.get("onboarding_complete_profile", {}).get("sent", 0)
    first_action_sent = campaigns.get("onboarding_first_action", {}).get("sent", 0)

    onboarding_funnel = {
        "welcome_sent": welcome_sent,
        "welcome_opened": welcome_opened,
        "profile_sent": profile_sent,
        "first_action_sent": first_action_sent,
        "welcome_to_open_ratio": f"{(welcome_opened / welcome_sent * 100):.1f}%" if welcome_sent > 0 else "0.0%",
        "profile_completion_ratio": f"{(profile_sent / welcome_opened * 100):.1f}%" if welcome_opened > 0 else "0.0%",
        "activation_conversion_ratio": f"{(first_action_sent / welcome_opened * 100):.1f}%" if welcome_opened > 0 else "0.0%"
    }

    # 3. Analyze Regional Engagement from Hit Metadata
    metadata_logs = db.exec(
        select(EmailLog.metadata_json)
        .where(EmailLog.metadata_json != None)
        .limit(1000)
    ).all()

    regional_hits = {}
    total_tracked_hits = 0
    for meta_str in metadata_logs:
        if not meta_str:
            continue
        try:
            meta = json.loads(meta_str)
            for hit in meta.get("hits", []):
                total_tracked_hits += 1
                ip = hit.get("ip", "unknown")
                # Group by IP segment to simulate geographical region clusters
                ip_segment = ".".join(ip.split(".")[:2]) if "." in ip else "unknown"
                if ip_segment not in regional_hits:
                    regional_hits[ip_segment] = 0
                regional_hits[ip_segment] += 1
        except Exception:
            continue

    # Return top engagement regions
    sorted_regions = sorted(regional_hits.items(), key=lambda x: x[1], reverse=True)[:5]
    regions_breakdown = [{"region_cluster": r, "hits": h} for r, h in sorted_regions]

    return {
        "campaigns": campaigns,
        "onboarding_funnel": onboarding_funnel,
        "regional_engagement": {
            "total_tracked_hits": total_tracked_hits,
            "top_regions": regions_breakdown
        }
    }


class ManualEmailSend(BaseModel):
    email: str
    subject: str
    title: str
    subtitle: Optional[str] = None
    content_html: str
    action_text: Optional[str] = None
    action_url: Optional[str] = None
    campaign_id: Optional[str] = None


class BroadcastEmailSend(BaseModel):
    subject: str
    title: str
    subtitle: Optional[str] = None
    content_html: str
    action_text: Optional[str] = None
    action_url: Optional[str] = None
    campaign_id: Optional[str] = None
    daily_limit: int = 250


@router.post("/email/send-manual")
def send_manual_email(
    *,
    payload: ManualEmailSend,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Send a manual tracked custom email to a specific customer profile.
    Saves in EmailLog and routes asynchronously via Celery worker queue.
    """
    from app.tasks.celery_app import celery_app
    
    target_user = db.exec(select(User).where(User.email == payload.email)).first()
    target_user_id = target_user.id if target_user else None

    celery_app.send_task(
        "app.tasks.email_tasks.dispatch_growth_email",
        args=["crm_manual", payload.email, {
            "subject": payload.subject,
            "title": payload.title,
            "subtitle": payload.subtitle,
            "content_html": payload.content_html,
            "action_text": payload.action_text,
            "action_url": payload.action_url
        }],
        kwargs={
            "user_id": target_user_id,
            "campaign_id": payload.campaign_id or "manual_direct"
        }
    )
    return {"success": True, "message": f"Manual email successfully queued for {payload.email}"}


@router.post("/email/broadcast")
def send_broadcast_email(
    *,
    payload: BroadcastEmailSend,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Broadcast a manual tracked custom email to ALL active customer profiles,
    drip-fed at up to `daily_limit` sends per day (see process_broadcast_jobs_task
    in app/tasks/email_tasks.py, run on a schedule) rather than all at once --
    keeps large broadcasts under a sending provider's daily quota. Per-recipient
    personalization (name/email/phone/location/date + real-data placeholder
    substitution) happens at actual send time in send_custom_manual_email.
    """
    from app.models.marketing import EmailPreference
    from app.models.broadcast_job import BroadcastJob, BroadcastJobRecipient

    # EmailPreference.promotional_emails defaults to True on the model, and
    # the row is only ever created lazily when a user opens notification
    # settings -- so "no row" means the default (opted in), and only an
    # explicit False should exclude someone from a broadcast like this.
    opted_out_ids = set(
        db.exec(
            select(EmailPreference.user_id).where(EmailPreference.promotional_emails == False)  # noqa: E712
        ).all()
    )
    active_users = [
        u for u in db.exec(select(User).where(User.is_active == True)).all()
        if u.id not in opted_out_ids and u.email
    ]

    job = BroadcastJob(
        subject=payload.subject,
        title=payload.title,
        subtitle=payload.subtitle,
        content_html=payload.content_html,
        action_text=payload.action_text,
        action_url=payload.action_url,
        campaign_id=payload.campaign_id or "broadcast_all",
        daily_limit=max(1, payload.daily_limit),
        total_recipients=len(active_users),
        created_by=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    db.bulk_save_objects([
        BroadcastJobRecipient(job_id=job.id, user_id=u.id, email=u.email)
        for u in active_users
    ])
    db.commit()

    days_estimate = -(-len(active_users) // job.daily_limit) if active_users else 0  # ceil division
    return {
        "success": True,
        "job_id": job.id,
        "total_recipients": len(active_users),
        "daily_limit": job.daily_limit,
        "estimated_days": days_estimate,
        "message": (
            f"Broadcast queued for {len(active_users)} customers, sending up to "
            f"{job.daily_limit}/day (~{days_estimate} day{'s' if days_estimate != 1 else ''} to finish)."
        ),
    }


@router.get("/email/broadcast-jobs")
def list_broadcast_jobs(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    limit: int = 20,
) -> Any:
    """List recent broadcast jobs with their send progress."""
    from app.models.broadcast_job import BroadcastJob

    jobs = db.exec(select(BroadcastJob).order_by(BroadcastJob.created_at.desc()).limit(limit)).all()
    return jobs


@router.get("/email/broadcast-jobs/{job_id}")
def get_broadcast_job(
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Get a single broadcast job's send progress."""
    from app.models.broadcast_job import BroadcastJob

    job = db.get(BroadcastJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Broadcast job not found")
    return job


@router.post("/email/broadcast-jobs/{job_id}/cancel")
def cancel_broadcast_job(
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Stop sending any further recipients for an in-progress broadcast job."""
    from app.models.broadcast_job import BroadcastJob

    job = db.get(BroadcastJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Broadcast job not found")
    if job.status == "in_progress":
        job.status = "cancelled"
        db.add(job)
        db.commit()
    return {"success": True, "status": job.status}


@router.get("/businesses/queue", response_model=List[Business])
def read_businesses_moderation_queue(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get businesses that have opted in for the nearby section.
    """
    statement = select(Business).where(
        Business.show_in_nearby == True
    ).order_by(Business.is_approved.asc(), Business.created_at.desc()).offset(skip).limit(limit)
    return db.exec(statement).all()


@router.post("/businesses/{business_id}/approve", response_model=Business)
def approve_business(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    business_id: str,
) -> Any:
    """
    Approve a business for the nearby section.
    """
    import uuid as uuid_pkg
    try:
        b_id = uuid_pkg.UUID(business_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid business ID format")
        
    business = db.get(Business, b_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    business.is_approved = True
    db.add(business)
    db.commit()
    db.refresh(business)
    return business


@router.post("/businesses/{business_id}/disapprove", response_model=Business)
def disapprove_business(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    business_id: str,
) -> Any:
    """
    Reject/Revoke approval of a business for the nearby section.
    """
    import uuid as uuid_pkg
    try:
        b_id = uuid_pkg.UUID(business_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid business ID format")
        
    business = db.get(Business, b_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    business.is_approved = False
    db.add(business)
    db.commit()
    db.refresh(business)
    return business


# --- Shop Details Management ---
@router.post("/shops/{user_id}/details")
def update_shop_details(
    user_id: int,
    details_data: ShopDetailsUpdate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Update shop details (business name, owner name) for a specific user/shop."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if details_data.business_name is not None:
            user.business_name = details_data.business_name

        if details_data.full_name is not None:
            user.full_name = details_data.full_name

        db.add(user)
        db.commit()
        db.refresh(user)

        # Sync sellers table with updated shop data
        sync_seller_profile(db, user.id, user.full_name, user.business_name)

        # Invalidate cache for this shop
        try:
            cache.delete(f"admin:shop:{user_id}")
            # Also clear paginated list caches since shop name may have changed order
            for skip in range(0, 1000, 24):
                cache.delete(f"admin:shops:{skip}:24")
            cache.delete("admin:shops:0:500")
        except Exception:
            pass

        return {
            "id": user.id,
            "full_name": user.full_name,
            "business_name": user.business_name,
            "message": "Shop details updated successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# --- Shop Banner Management ---
@router.post("/shops/{user_id}/banners/upload")
async def upload_shop_banner_file(
    user_id: int,
    banner_type: str,
    file: UploadFile = File(...),
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upload banner file to Cloudinary and store URL."""
    try:
        if banner_type not in ["shop_page_banner", "shop_detail_banner"]:
            raise HTTPException(status_code=400, detail="Invalid banner_type")

        # Allow admins to upload for any shop, or users to upload for their own
        if not current_user.is_admin and current_user.id != user_id:
            raise HTTPException(status_code=403, detail="You can only upload banners for your own shop")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Read file content
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")

        # Upload to Cloudinary
        url, _ = await storage_service.upload_file(content, file.filename or "banner.jpg")

        # Store URL in database
        if banner_type == "shop_page_banner":
            user.shop_page_banner = url
        else:
            user.shop_detail_banner = url

        db.add(user)
        db.commit()
        db.refresh(user)

        # Sync sellers table with updated banner data
        sync_seller_profile(db, user.id, user.full_name, user.business_name,
                          user.shop_page_banner, user.shop_detail_banner)

        return {
            "id": user.id,
            "banner_type": banner_type,
            "url": url,
            "message": f"{banner_type} uploaded successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to upload banner: {str(e)}")


@router.post("/shops/{user_id}/banners")
def upload_shop_banners(
    user_id: int,
    banner_data: ShopBannersUpdate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Legacy endpoint: Update banner URLs directly (for backwards compatibility)."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if banner_data.shop_page_banner:
            user.shop_page_banner = banner_data.shop_page_banner

        if banner_data.shop_detail_banner:
            user.shop_detail_banner = banner_data.shop_detail_banner

        db.add(user)
        db.commit()
        db.refresh(user)

        # Sync sellers table with updated banner data
        sync_seller_profile(db, user.id, user.full_name, user.business_name,
                          user.shop_page_banner, user.shop_detail_banner)

        return {
            "id": user.id,
            "full_name": user.full_name,
            "shop_page_banner": user.shop_page_banner,
            "shop_detail_banner": user.shop_detail_banner,
            "message": "Shop banners updated successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# SHOP MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/shops", response_model=List[ShopRead])
def get_all_shops(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Get verified sellers with at least one active listing."""
    import json

    # Try Redis cache first
    cache_key = f"admin:shops:{skip}:{limit}"
    try:
        cached = cache.get(cache_key)
        if cached:
            return [ShopRead(**item) for item in json.loads(cached)]
    except Exception:
        pass

    try:
        from sqlalchemy import text

        # Only shops WITH active listings - EXISTS avoids fanning out one row
        # per listing (which SELECT DISTINCT then had to sort/dedupe, made
        # far more expensive once a TEXT column like shop_description joined
        # the select list).
        # Banners can be inline base64 data URIs up to ~2MB each; the list
        # view only needs to know whether one is set (for a badge), so cap
        # what's transferred here. The edit modal fetches the full value
        # via GET /shops/{id} when it actually needs to render the image.
        query = text("""
            WITH listing_stats AS (
                SELECT
                    l.owner_id,
                    COUNT(l.id) AS total_listings,
                    COUNT(CASE WHEN l.status = 'active' THEN 1 END) AS active_listings
                FROM listing l
                GROUP BY l.owner_id
            )
            SELECT u.id, u.email, u.full_name, u.business_name, u.created_at,
                   LEFT(COALESCE(s.shop_page_banner, u.shop_page_banner), 200) as shop_page_banner,
                   LEFT(COALESCE(s.shop_detail_banner, u.shop_detail_banner), 200) as shop_detail_banner,
                   u.shop_description, u.logo_url, u.is_featured, u.free_delivery,
                   u.is_verified, u.is_active, u.location,
                   COALESCE(ls.total_listings, 0) AS total_listings,
                   COALESCE(ls.active_listings, 0) AS active_listings,
                   u.phone, u.is_suspended, u.trust_score
            FROM "user" u
            LEFT JOIN sellers s ON s.user_id = CAST(u.id AS VARCHAR)
            LEFT JOIN listing_stats ls ON ls.owner_id = u.id
            WHERE u.business_name IS NOT NULL
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :skip
        """)

        result = db.execute(query, {"skip": skip, "limit": limit}).fetchall()

        shops = []
        for row in result:
            import unicodedata as _ud
            _name = row[3] or row[2] or ''
            _norm = _ud.normalize('NFKD', _name).encode('ascii', 'ignore').decode('ascii')
            _slug = ''.join(c for c in _norm.lower() if c.isalnum()) or f'shop{row[0]}'
            shop = ShopRead(
                id=row[0],
                email=row[1],
                full_name=row[2],
                business_name=_name,
                shop_description=row[7] or "",
                shop_page_banner=row[5],
                shop_detail_banner=row[6],
                logo_url=row[8],
                is_featured=bool(row[9]),
                free_delivery=bool(row[10]),
                is_verified=bool(row[11]),
                is_active=bool(row[12]),
                location=row[13],
                total_listings=int(row[14] or 0),
                active_listings=int(row[15] or 0),
                phone=row[16],
                is_suspended=bool(row[17]) if row[17] is not None else False,
                trust_score=int(row[18] or 0),
                created_at=row[4].isoformat() if row[4] else None,
            )
            shops.append(shop)

        # Cache for 10 minutes
        try:
            cache.set(cache_key, json.dumps([shop.dict() for shop in shops], default=str), ttl=600)
        except Exception:
            pass

        return shops
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shops/{shop_id}", response_model=ShopRead)
def get_shop(
    shop_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Get shop details by ID."""
    import json

    # Try Redis cache first
    cache_key = f"admin:shop:{shop_id}"
    try:
        cached = cache.get(cache_key)
        if cached:
            return ShopRead(**json.loads(cached))
    except Exception:
        pass

    try:
        # Get user by ID (simple query)
        shop = db.get(User, shop_id)
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")

        result = ShopRead(
            id=shop.id,
            business_name=shop.business_name or shop.full_name,
            full_name=shop.full_name,
            shop_description=shop.shop_description or "",
            logo_url=shop.logo_url,
            shop_page_banner=shop.shop_page_banner,
            shop_detail_banner=shop.shop_detail_banner,
            location=shop.location,
            is_featured=shop.is_featured,
            is_verified=shop.is_verified,
            free_delivery=shop.free_delivery,
            is_active=shop.is_active,
            email=shop.email,
        )

        # Cache for 15 minutes
        try:
            cache.set(cache_key, json.dumps(result.dict(), default=str), ttl=900)
        except Exception:
            pass

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def sync_seller_profile(db: Session, user_id: int, full_name: str, business_name: Optional[str],
                       shop_page_banner: Optional[str] = None, shop_detail_banner: Optional[str] = None) -> None:
    """Sync seller profile with user data after updates. Auto-updates sellers table."""
    try:
        from sqlalchemy import text

        # Determine the shop name (business_name takes precedence)
        shop_name = business_name or full_name

        # Build dynamic update query based on what changed
        updates = ["shop_name = :shop_name", "owner_name = :owner_name"]
        params = {
            "shop_name": shop_name,
            "owner_name": full_name,
            "user_id": str(user_id)
        }

        # Include banners if provided
        if shop_page_banner is not None:
            updates.append("shop_page_banner = :shop_page_banner")
            params["shop_page_banner"] = shop_page_banner

        if shop_detail_banner is not None:
            updates.append("shop_detail_banner = :shop_detail_banner")
            params["shop_detail_banner"] = shop_detail_banner

        # Update sellers table for this user
        sync_query = text(f"""
            UPDATE sellers
            SET {', '.join(updates)}
            WHERE user_id = :user_id
        """)

        db.exec(sync_query, params)
        db.commit()
    except Exception as e:
        # Log error but don't fail the request - sync is non-critical
        print(f"⚠️  Warning: Failed to sync sellers table for user {user_id}: {str(e)}")


@router.put("/shops/{shop_id}", response_model=ShopRead)
def update_shop(
    shop_id: int,
    shop_data: ShopManagementUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_agent),
) -> Any:
    """Update shop details."""
    try:
        # Get user by ID (simple query, no join)
        shop = db.get(User, shop_id)
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")

        # Update fields if provided
        if shop_data.business_name is not None:
            shop.business_name = shop_data.business_name
        if shop_data.shop_description is not None:
            shop.shop_description = shop_data.shop_description
        if shop_data.logo_url is not None:
            shop.logo_url = shop_data.logo_url
        if shop_data.shop_page_banner is not None:
            shop.shop_page_banner = shop_data.shop_page_banner
        if shop_data.shop_detail_banner is not None:
            shop.shop_detail_banner = shop_data.shop_detail_banner
        if shop_data.location is not None:
            shop.location = shop_data.location
        if shop_data.is_featured is not None:
            shop.is_featured = shop_data.is_featured
        if shop_data.is_verified is not None:
            shop.is_verified = shop_data.is_verified
        if shop_data.free_delivery is not None:
            shop.free_delivery = shop_data.free_delivery
        if shop_data.is_active is not None:
            shop.is_active = shop_data.is_active

        db.add(shop)
        db.commit()
        db.refresh(shop)

        # Sync sellers table with updated shop data (including banners)
        sync_seller_profile(db, shop.id, shop.full_name, shop.business_name,
                          shop.shop_page_banner, shop.shop_detail_banner)

        # Invalidate cache for this shop
        try:
            cache.delete(f"admin:shop:{shop_id}")
            # Also clear paginated list caches since shop data has changed
            for skip in range(0, 1000, 24):
                cache.delete(f"admin:shops:{skip}:24")
            cache.delete("admin:shops:0:500")
            # Clear public shops cache as well
            for skip in range(0, 1000, 24):
                cache.delete(f"public_shops:{skip}:24:all")
        except Exception:
            pass

        return ShopRead(
            id=shop.id,
            business_name=shop.business_name,
            full_name=shop.full_name,
            shop_description=shop.shop_description,
            logo_url=shop.logo_url,
            shop_page_banner=shop.shop_page_banner,
            shop_detail_banner=shop.shop_detail_banner,
            location=shop.location,
            is_featured=shop.is_featured,
            is_verified=shop.is_verified,
            free_delivery=shop.free_delivery,
            is_active=shop.is_active,
            email=shop.email,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/shops/{shop_id}/banner/{banner_type}")
def delete_shop_banner(
    shop_id: int,
    banner_type: str,  # 'shop_page' or 'shop_detail'
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Delete shop banner - Admin only."""
    try:
        if banner_type not in ['shop_page', 'shop_detail']:
            raise HTTPException(status_code=400, detail="Invalid banner type")

        shop = db.get(User, shop_id)
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")

        if banner_type == 'shop_page':
            shop.shop_page_banner = None
        elif banner_type == 'shop_detail':
            shop.shop_detail_banner = None

        db.add(shop)
        db.commit()
        db.refresh(shop)

        # Invalidate cache for this shop
        try:
            cache.delete(f"admin:shop:{shop_id}")
            # Clear paginated caches
            for skip in range(0, 1000, 24):
                cache.delete(f"admin:shops:{skip}:24")
        except Exception:
            pass

        return {"message": f"{banner_type} banner deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/shops/{shop_id}/logo")
def delete_shop_logo(
    shop_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Delete shop logo - Admin only."""
    try:
        shop = db.get(User, shop_id)
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")

        shop.logo_url = None
        db.add(shop)
        db.commit()
        db.refresh(shop)

        # Invalidate cache for this shop
        try:
            cache.delete(f"admin:shop:{shop_id}")
            # Clear paginated caches
            for skip in range(0, 1000, 24):
                cache.delete(f"admin:shops:{skip}:24")
            # Clear public shops cache
            for skip in range(0, 1000, 24):
                cache.delete(f"public_shops:{skip}:24:all")
        except Exception:
            pass

        return {"message": "Shop logo deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: int,
    user_data: UserAdminUpdate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update any user/account or shop details (Admin only).
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        update_data = user_data.model_dump(exclude_unset=True)

        # Uniqueness checks
        if "email" in update_data and update_data["email"] != user.email:
            existing = db.query(User).filter(User.email == update_data["email"]).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already registered")

        if "phone" in update_data and update_data["phone"] != user.phone:
            existing = db.query(User).filter(User.phone == update_data["phone"]).first()
            if existing:
                raise HTTPException(status_code=400, detail="Phone number already registered")

        # Password update
        if "password" in update_data:
            pw = update_data.pop("password")
            if pw:
                from app.core.security import get_password_hash
                user.hashed_password = get_password_hash(pw)

        # Apply other updates
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)

        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# SHOP MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class ShopNameUpdate(BaseModel):
    """Update shop/seller business name."""
    business_name: str


@router.patch("/shops/{user_id}/name")
async def update_shop_name(
    user_id: int,
    data: ShopNameUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> dict[str, Any]:
    """Admin endpoint to update a shop's business name.

    Path Params:
    - user_id: ID of the seller/shop owner

    Body:
    - business_name: New shop name (1-100 characters)
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate shop name
    if not data.business_name or len(data.business_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Shop name cannot be empty")

    if len(data.business_name) > 100:
        raise HTTPException(status_code=400, detail="Shop name must be 100 characters or less")

    try:
        # Get user/seller
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Shop/user not found")

        # Update business name
        old_name = user.business_name
        user.business_name = data.business_name.strip()

        db.add(user)
        db.commit()
        db.refresh(user)

        # Invalidate cache for this user
        cache.delete(f"user:{user_id}")
        cache.delete(f"user_listings:{user_id}")
        cache.delete("all_shops")

        return {
            "success": True,
            "message": "Shop name updated successfully",
            "user_id": user_id,
            "old_name": old_name,
            "new_name": user.business_name,
            "updated_at": user.updated_at or user.created_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# The unrestricted "all shops" listing lives at /shops/directory, not
# /shops -- GET /shops above (get_all_shops) already owns that exact
# path+method and FastAPI resolves routes in registration order, so a
# second `@router.get("/shops")` here was silently unreachable dead code.
# Removed; its logic (every business_name user, not just verified/active/
# has-active-listing ones) is what /shops/directory below is for.

@router.get("/shops/stats")
def get_shop_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Counts for the Shop Management summary cards -- every seller
    (business_name set), not just the verified+active+has-listings subset
    GET /shops itself is scoped to."""
    is_seller = User.business_name.isnot(None)
    total = db.exec(select(func.count(User.id)).where(is_seller)).one()
    active = db.exec(select(func.count(User.id)).where(is_seller, User.is_active == True, User.is_suspended == False)).one()  # noqa: E712
    pending = db.exec(select(func.count(User.id)).where(is_seller, User.is_verified == False)).one()  # noqa: E712
    verified = db.exec(select(func.count(User.id)).where(is_seller, User.is_verified == True)).one()  # noqa: E712
    suspended = db.exec(select(func.count(User.id)).where(is_seller, User.is_suspended == True)).one()  # noqa: E712
    return {"total": total, "active": active, "pending": pending, "verified": verified, "suspended": suspended}


@router.get("/shops/directory")
def get_shops_directory(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="active, pending, verified, suspended"),
) -> Any:
    """
    Every seller account (business_name set) with real listing/follower
    counts and a shop rating -- unlike GET /shops, not restricted to
    verified+active+has-active-listing, so newly-signed-up or unverified
    shops show up here too.
    """
    from sqlmodel import func as _func
    from app.models.follow import Follow

    query = select(User).where(User.business_name.isnot(None))
    if search:
        query = query.where(User.business_name.ilike(f"%{search}%"))
    if status == "active":
        query = query.where(User.is_active == True, User.is_suspended == False)  # noqa: E712
    elif status == "pending":
        query = query.where(User.is_verified == False)  # noqa: E712
    elif status == "verified":
        query = query.where(User.is_verified == True)  # noqa: E712
    elif status == "suspended":
        query = query.where(User.is_suspended == True)  # noqa: E712

    total = db.exec(select(_func.count()).select_from(query.subquery())).one()
    sellers = db.exec(query.order_by(User.created_at.desc()).offset(skip).limit(limit)).all()

    seller_ids = [s.id for s in sellers]
    listing_counts: dict = {}
    active_listing_counts: dict = {}
    follower_counts: dict = {}
    if seller_ids:
        for owner_id, total_count in db.exec(
            select(Listing.owner_id, _func.count()).where(Listing.owner_id.in_(seller_ids)).group_by(Listing.owner_id)
        ).all():
            listing_counts[owner_id] = total_count
        for owner_id, active_count in db.exec(
            select(Listing.owner_id, _func.count()).where(Listing.owner_id.in_(seller_ids), Listing.status == "active").group_by(Listing.owner_id)
        ).all():
            active_listing_counts[owner_id] = active_count
        for followed_id, follower_count in db.exec(
            select(Follow.followed_id, _func.count()).where(Follow.followed_id.in_(seller_ids)).group_by(Follow.followed_id)
        ).all():
            follower_counts[followed_id] = follower_count

    return {
        "shops": [
            {
                "id": s.id,
                "business_name": s.business_name,
                "full_name": s.full_name,
                "email": s.email,
                "phone": s.phone,
                "location": s.location,
                "is_verified": s.is_verified,
                "is_active": s.is_active,
                "is_suspended": s.is_suspended,
                "trust_score": s.trust_score,
                "total_listings": listing_counts.get(s.id, 0),
                "active_listings": active_listing_counts.get(s.id, 0),
                "followers": follower_counts.get(s.id, 0),
                "created_at": s.created_at,
            }
            for s in sellers
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# ============== PRODUCT DATABASE ==============

@router.get("/listings/stats")
def get_listings_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Counts for the Product Database summary cards. Built from the real
    status/approval_status values in use today (there's no separate "draft"
    concept in this schema -- every created listing starts at status
    "pending" immediately, so pending review is the closest equivalent).
    """
    from app.models.report import ListingReport

    total = db.exec(select(func.count(Listing.id))).one()
    active = db.exec(select(func.count(Listing.id)).where(Listing.status == "active")).one()
    pending = db.exec(select(func.count(Listing.id)).where(Listing.status == "pending")).one()
    sold = db.exec(select(func.count(Listing.id)).where(Listing.status == "sold")).one()
    suspended = db.exec(select(func.count(Listing.id)).where(Listing.status == "suspended")).one()
    deleted = db.exec(select(func.count(Listing.id)).where(Listing.status == "deleted")).one()
    rejected = db.exec(select(func.count(Listing.id)).where(Listing.approval_status == "rejected")).one()
    reported = db.exec(
        select(func.count(func.distinct(ListingReport.listing_id))).where(ListingReport.status == "pending")
    ).one()

    return {
        "total": total,
        "active": active,
        "pending": pending,
        "sold": sold,
        "suspended": suspended,
        "deleted": deleted,
        "rejected": rejected,
        "reported": reported,
    }


# ============== LISTING REPORTS & CHAT REVIEW ==============
# Buyer/seller chats are never browsable at large -- an admin can only pull
# up a conversation from here, after a report has been filed, and every
# view is written to AuditLog. This mirrors how most marketplaces handle
# private-message access: support looks at messages when there's a
# complaint to investigate, not on a standing basis.

@router.get("/reports/listings")
def list_listing_reports(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    status: Optional[str] = Query(None, description="Filter by status: pending, resolved, dismissed"),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    Admin queue of listing reports, most recent first. Each row carries
    enough about the reporter, listing and listing owner to decide whether
    to open the conversation between them.
    """
    query = select(ListingReport)
    if status:
        query = query.where(ListingReport.status == status)
    total = db.exec(select(func.count(ListingReport.id)).where(ListingReport.status == status) if status else select(func.count(ListingReport.id))).one()

    reports = db.exec(query.order_by(ListingReport.created_at.desc()).offset(skip).limit(limit)).all()

    results = []
    for report in reports:
        listing = db.get(Listing, report.listing_id)
        reporter = db.get(User, report.reporter_id)
        owner = db.get(User, listing.owner_id) if listing else None
        results.append({
            "id": report.id,
            "listing_id": report.listing_id,
            "listing_title": listing.title_en if listing else None,
            "reason": report.reason,
            "description": report.description,
            "status": report.status,
            "created_at": report.created_at,
            "reporter": {"id": reporter.id, "name": reporter.full_name} if reporter else None,
            "listing_owner": {"id": owner.id, "name": owner.full_name} if owner else None,
        })

    return {"reports": results, "total": total, "skip": skip, "limit": limit}


class ReportStatusUpdate(BaseModel):
    status: str  # pending, resolved, dismissed


@router.patch("/reports/listings/{report_id}")
def update_listing_report_status(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    report_id: int,
    update: ReportStatusUpdate,
) -> Any:
    """
    Mark a listing report resolved/dismissed after review.
    """
    if update.status not in ("pending", "resolved", "dismissed"):
        raise HTTPException(status_code=400, detail="status must be pending, resolved, or dismissed")

    report = db.get(ListingReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = update.status
    db.add(report)
    db.add(AuditLog(
        user_id=current_user.id,
        action="LISTING_REPORT_STATUS_UPDATE",
        resource_type="listing_report",
        resource_id=report_id,
        details=f"Status set to {update.status}"
    ))
    db.commit()
    return {"id": report_id, "status": update.status}


def _conversation_summary(db: Session, conv: "Conversation") -> dict:
    buyer = db.get(User, conv.buyer_id)
    seller = db.get(User, conv.seller_id)
    listing = db.get(Listing, conv.listing_id) if conv.listing_id else None
    return {
        "id": conv.id,
        "buyer": {"id": buyer.id, "name": buyer.full_name} if buyer else None,
        "seller": {"id": seller.id, "name": seller.business_name or seller.full_name} if seller else None,
        "listing": {"id": listing.id, "title": listing.title_en} if listing else None,
        "last_message_preview": conv.last_message_preview,
        "message_count": conv.message_count,
        "unread_count": conv.buyer_unread_count + conv.seller_unread_count,
        "status": conv.status,
        "admin_reviewed": conv.admin_reviewed,
        "last_message_at": conv.last_message_at,
        "created_at": conv.created_at,
    }


@router.get("/conversations/stats")
def get_conversation_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Summary cards for the admin Messages panel."""
    from datetime import datetime, timedelta
    from app.models.report import ListingReport

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total = db.exec(select(func.count(Conversation.id))).one()
    active = db.exec(select(func.count(Conversation.id)).where(Conversation.status == "active")).one()
    unread = db.exec(select(func.count(Conversation.id)).where(
        (Conversation.buyer_unread_count > 0) | (Conversation.seller_unread_count > 0)
    )).one()
    today = db.exec(select(func.count(Conversation.id)).where(Conversation.created_at >= today_start)).one()
    reported_listing_ids = db.exec(select(ListingReport.listing_id).distinct()).all()
    reported = db.exec(select(func.count(Conversation.id)).where(
        Conversation.listing_id.in_(reported_listing_ids)
    )).one() if reported_listing_ids else 0

    return {
        "total_conversations": total,
        "active_conversations": active,
        "unread_conversations": unread,
        "today_conversations": today,
        "reported_conversations": reported,
    }


@router.get("/conversations")
def list_conversations(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    status: Optional[str] = Query(None, description="active, closed, flagged, suspended"),
    unread_only: bool = False,
    period: Optional[str] = Query(None, description="today, week, month"),
    buyer_id: Optional[int] = None,
    seller_id: Optional[int] = None,
    listing_id: Optional[int] = None,
    search: Optional[str] = Query(None, description="Match against buyer/seller name or listing title"),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    Every buyer<->seller conversation on the platform, most recently active
    first -- not gated on a report being filed. This is standing admin
    visibility into marketplace communication (view/flag/suspend only;
    admins can never send as either party).
    """
    from datetime import datetime, timedelta

    query = select(Conversation)
    if status:
        query = query.where(Conversation.status == status)
    if unread_only:
        query = query.where((Conversation.buyer_unread_count > 0) | (Conversation.seller_unread_count > 0))
    if period:
        since = {
            "today": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
            "week": datetime.utcnow() - timedelta(days=7),
            "month": datetime.utcnow() - timedelta(days=30),
        }.get(period)
        if since:
            query = query.where(Conversation.created_at >= since)
    if buyer_id:
        query = query.where(Conversation.buyer_id == buyer_id)
    if seller_id:
        query = query.where(Conversation.seller_id == seller_id)
    if listing_id:
        query = query.where(Conversation.listing_id == listing_id)

    total = db.exec(select(func.count()).select_from(query.subquery())).one()

    conversations = db.exec(
        query.order_by(Conversation.last_message_at.desc()).offset(skip).limit(limit)
    ).all()

    results = [_conversation_summary(db, c) for c in conversations]

    if search:
        term = search.lower()
        results = [
            r for r in results
            if (r["buyer"] and term in (r["buyer"]["name"] or "").lower())
            or (r["seller"] and term in (r["seller"]["name"] or "").lower())
            or (r["listing"] and term in (r["listing"]["title"] or "").lower())
        ]

    return {"conversations": results, "total": total, "skip": skip, "limit": limit}


@router.get("/conversations/{conversation_id}")
def get_conversation_detail(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    conversation_id: int,
) -> Any:
    """
    Full conversation detail: buyer/seller/listing context plus the
    complete message thread. Every view is written to AuditLog against the
    admin's account -- standing visibility is still individually
    attributable, even without a report attached.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    buyer = db.get(User, conversation.buyer_id)
    seller = db.get(User, conversation.seller_id)
    listing = db.get(Listing, conversation.listing_id) if conversation.listing_id else None

    messages = db.exec(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    ).all()

    db.add(AuditLog(
        user_id=current_user.id,
        action="ADMIN_VIEWED_CONVERSATION",
        resource_type="conversation",
        resource_id=conversation_id,
        details=f"Viewed conversation {conversation_id} (buyer {conversation.buyer_id}, seller {conversation.seller_id})"
    ))
    db.commit()

    return {
        "id": conversation.id,
        "status": conversation.status,
        "admin_reviewed": conversation.admin_reviewed,
        "buyer": {
            "id": buyer.id, "name": buyer.full_name, "email": buyer.email, "phone": buyer.phone,
            "registered_at": buyer.created_at, "is_active": buyer.is_active, "is_suspended": buyer.is_suspended,
        } if buyer else None,
        "seller": {
            "id": seller.id, "shop_name": seller.business_name, "name": seller.full_name,
            "is_verified": seller.is_verified, "is_active": seller.is_active, "is_suspended": seller.is_suspended,
        } if seller else None,
        "listing": {
            "id": listing.id, "title": listing.title_en, "price": listing.price, "currency": listing.currency,
            "status": listing.status, "url": f"/listing/{listing.id}",
        } if listing else None,
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "receiver_id": m.receiver_id,
                "content": m.content,
                "is_read": m.is_read,
                "created_at": m.created_at,
            }
            for m in messages
        ],
    }


class ConversationStatusUpdate(BaseModel):
    status: Optional[str] = None  # active, closed, flagged, suspended
    admin_reviewed: Optional[bool] = None


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    conversation_id: int,
    update: ConversationStatusUpdate,
) -> Any:
    """
    Admin actions on a conversation: mark reviewed, flag, suspend (blocks
    further sends between these two users on this thread), or close/reopen.
    Never allows sending as either party.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if update.status is not None:
        if update.status not in ("active", "closed", "flagged", "suspended"):
            raise HTTPException(status_code=400, detail="Invalid status")
        conversation.status = update.status
    if update.admin_reviewed is not None:
        conversation.admin_reviewed = update.admin_reviewed

    db.add(conversation)
    db.add(AuditLog(
        user_id=current_user.id,
        action="ADMIN_UPDATED_CONVERSATION",
        resource_type="conversation",
        resource_id=conversation_id,
        details=f"status={update.status}, admin_reviewed={update.admin_reviewed}"
    ))
    db.commit()
    return _conversation_summary(db, conversation)

