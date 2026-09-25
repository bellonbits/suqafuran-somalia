"""
Complete Listing Creation Endpoint with Moderation, Payment, and Notifications.

Full workflow:
1. Seller creates listing
2. Listing created in DB (moderation_status="pending")
3. Kafka event published: "catalog.product.created"
4. Admin notified for moderation
5. Admin approves/rejects
6. If approved: seller gets notification
7. Listing becomes visible to customers
8. Optionally: seller can pay to feature listing
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.session import get_db
from app.schemas.listing import ListingCreate, ListingResponse
from app.models.listing import Listing
from app.models.featured_listing import FeaturedListing
from app.models.user import User
from app.auth.auth import get_current_user
from app.services.kafka_producer import (
    publish_catalog_event,
    publish_notification_dispatch,
    publish_payment_event,
)
import logging

logger = logging.getLogger("listings_api")
router = APIRouter(prefix="/listings", tags=["listings"])


# ============= CREATE LISTING (WITH MODERATION) =============

@router.post("/", response_model=ListingResponse)
async def create_listing(
    listing: ListingCreate,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    """
    Create a new listing (product ad).

    Workflow:
    1. Upload images
    2. Create listing with moderation_status="pending"
    3. Publish Kafka event
    4. Notify admins for moderation
    5. Send seller confirmation
    """

    # Upload images
    image_urls = []
    for file in files:
        url = await upload_image_to_s3(file)
        image_urls.append(url)

    if not image_urls:
        raise HTTPException(status_code=400, detail="At least one image required")

    # Create listing (DRAFT - not yet visible)
    db_listing = Listing(
        owner_id=current_user.id,
        title_en=listing.title_en,
        title_so=listing.title_so,
        description_en=listing.description_en,
        description_so=listing.description_so,
        price=listing.price,
        location=listing.location,
        condition=listing.condition,
        category_id=listing.category_id,
        subcategory_id=listing.subcategory_id,
        subsubcategory_id=listing.subsubcategory_id,
        images=image_urls,
        attributes=listing.attributes or {},
        status="pending",  # Not visible yet
        moderation_status="pending",  # Waiting for admin approval
    )
    db.add(db_listing)
    db.commit()
    db.refresh(db_listing)

    logger.info(
        f"Listing created",
        extra={
            "listing_id": db_listing.id,
            "owner_id": current_user.id,
            "moderation_status": "pending",
        }
    )

    # Publish Kafka event for moderation system
    await publish_catalog_event(
        event_type="product.created_pending_moderation",
        payload={
            "listing_id": str(db_listing.id),
            "owner_id": str(current_user.id),
            "title": db_listing.title_en,
            "price": float(db_listing.price),
            "category_id": db_listing.category_id,
            "images": image_urls,
            "description": db_listing.description_en[:100],  # First 100 chars
        },
        seller_id=str(current_user.id),
    )

    # Notify admins (email + internal notification)
    await publish_notification_dispatch(
        user_id="admin_team",  # Send to all admins
        event_type="catalog.product.pending_moderation",
        channels=["email", "push"],
        template="admin_listing_requires_moderation",
        data={
            "listing_id": str(db_listing.id),
            "seller_name": current_user.full_name or current_user.phone,
            "title": db_listing.title_en,
            "price": f"{db_listing.price} {db_listing.currency}",
        },
    )

    # Confirm to seller
    await publish_notification_dispatch(
        user_id=str(current_user.id),
        event_type="catalog.product.created_pending_moderation",
        channels=["push", "sms"],
        template="listing_submitted_for_review",
        data={
            "listing_id": str(db_listing.id),
            "title": db_listing.title_en,
        },
    )

    return ListingResponse.from_orm(db_listing)


# ============= ADMIN: APPROVE LISTING =============

@router.post("/{listing_id}/approve")
async def approve_listing(
    listing_id: int,
    moderation_notes: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),  # Must be admin
):
    """
    Admin approves a listing for visibility.

    Steps:
    1. Update listing status to "active"
    2. Update moderation_status to "approved"
    3. Publish Kafka event
    4. Notify seller (email + SMS)
    5. Notify customers (new product available)
    """

    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing.moderation_status = "approved"
    listing.status = "active"  # Now visible
    listing.moderated_at = datetime.utcnow()
    listing.moderator_id = current_admin.id
    listing.moderation_notes = moderation_notes

    db.commit()
    db.refresh(listing)

    logger.info(
        f"Listing approved",
        extra={
            "listing_id": listing_id,
            "moderator_id": current_admin.id,
        }
    )

    # Publish approval event
    await publish_catalog_event(
        event_type="product.approved_by_admin",
        payload={
            "listing_id": str(listing_id),
            "owner_id": str(listing.owner_id),
            "title": listing.title_en,
            "approved_by": current_admin.full_name,
            "approved_at": datetime.utcnow().isoformat(),
        },
        seller_id=str(listing.owner_id),
    )

    # Notify seller of approval
    seller = db.query(User).filter(User.id == listing.owner_id).first()
    await publish_notification_dispatch(
        user_id=str(listing.owner_id),
        event_type="catalog.product.approved",
        channels=["email", "sms", "push"],
        template="listing_approved",
        data={
            "listing_id": str(listing_id),
            "title": listing.title_en,
            "price": f"{listing.price} {listing.currency}",
        },
    )

    return {"status": "approved", "listing_id": listing_id}


# ============= ADMIN: REJECT LISTING =============

@router.post("/{listing_id}/reject")
async def reject_listing(
    listing_id: int,
    rejection_reason: str,
    moderation_notes: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Admin rejects a listing.

    Steps:
    1. Update status to "rejected"
    2. Store rejection reason
    3. Publish Kafka event
    4. Notify seller why (email + SMS with appeal instructions)
    5. Create support ticket for appeals
    """

    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing.moderation_status = "rejected"
    listing.status = "deleted"  # Hide from search
    listing.rejection_reason = rejection_reason
    listing.moderated_at = datetime.utcnow()
    listing.moderator_id = current_admin.id
    listing.moderation_notes = moderation_notes

    db.commit()
    db.refresh(listing)

    logger.warning(
        f"Listing rejected",
        extra={
            "listing_id": listing_id,
            "rejection_reason": rejection_reason,
            "moderator_id": current_admin.id,
        }
    )

    # Publish rejection event
    await publish_catalog_event(
        event_type="product.rejected_by_admin",
        payload={
            "listing_id": str(listing_id),
            "owner_id": str(listing.owner_id),
            "rejection_reason": rejection_reason,
            "rejected_by": current_admin.full_name,
        },
        seller_id=str(listing.owner_id),
    )

    # Notify seller of rejection (email + SMS with reason)
    await publish_notification_dispatch(
        user_id=str(listing.owner_id),
        event_type="catalog.product.rejected",
        channels=["email", "sms"],
        template="listing_rejected",
        data={
            "listing_id": str(listing_id),
            "title": listing.title_en,
            "rejection_reason": rejection_reason,
            "support_contact": "support@suqafuran.com",
            "appeal_link": f"https://app.suqafuran.com/appeal/{listing_id}",
        },
    )

    return {"status": "rejected", "listing_id": listing_id, "reason": rejection_reason}


# ============= FEATURE LISTING (PAID AD) =============

@router.post("/{listing_id}/feature")
async def feature_listing(
    listing_id: int,
    boost_level: str,  # "basic", "vip", "diamond"
    payment_method: str,  # "mpesa", "stripe", "paypal"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Seller pays to feature a listing (boost visibility).

    Pricing (example):
    - basic: 5,000 SOS / 30 days
    - vip: 15,000 SOS / 30 days
    - diamond: 50,000 SOS / 30 days

    Steps:
    1. Create FeaturedListing record (payment_status="pending")
    2. Publish payment.initiated event
    3. Initiate payment flow (M-Pesa/Stripe/PayPal)
    4. On success: activate featuring, publish notification
    5. On failure: refund, notify seller
    """

    # Validate listing exists and belongs to user
    listing = db.query(Listing).filter(
        Listing.id == listing_id,
        Listing.owner_id == current_user.id
    ).first()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or not owned by you")

    if listing.moderation_status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Listing must be approved before featuring"
        )

    # Pricing map
    PRICING = {
        "basic": {"amount": 5000, "duration": 30},
        "vip": {"amount": 15000, "duration": 30},
        "diamond": {"amount": 50000, "duration": 30},
    }

    if boost_level not in PRICING:
        raise HTTPException(status_code=400, detail="Invalid boost level")

    pricing = PRICING[boost_level]
    amount = pricing["amount"]
    duration_days = pricing["duration"]

    # Create FeaturedListing (payment pending)
    featured = FeaturedListing(
        listing_id=listing_id,
        owner_id=current_user.id,
        boost_level=boost_level,
        amount_paid=amount,
        currency="SOS",
        duration_days=duration_days,
        payment_method=payment_method,
        status="pending",
        payment_status="pending",
    )
    db.add(featured)
    db.commit()
    db.refresh(featured)

    logger.info(
        f"Featured listing created (payment pending)",
        extra={
            "featured_id": featured.id,
            "listing_id": listing_id,
            "boost_level": boost_level,
            "amount": amount,
        }
    )

    # Publish payment initiated event
    await publish_payment_event(
        event_type="featured_listing.payment_initiated",
        payload={
            "featured_listing_id": str(featured.id),
            "listing_id": str(listing_id),
            "seller_id": str(current_user.id),
            "boost_level": boost_level,
            "amount": amount,
            "currency": "SOS",
            "duration_days": duration_days,
        },
        order_id=str(featured.id),
        user_id=str(current_user.id),
    )

    # Send payment prompt to seller
    await publish_notification_dispatch(
        user_id=str(current_user.id),
        event_type="payments.featured_listing.initiated",
        channels=["sms", "push"],
        template="feature_listing_payment_prompt",
        data={
            "listing_title": listing.title_en,
            "boost_level": boost_level,
            "amount": amount,
            "featured_id": str(featured.id),
        },
    )

    # Return payment details (would trigger M-Pesa/Stripe popup)
    return {
        "featured_listing_id": featured.id,
        "status": "pending",
        "payment_required": {
            "amount": amount,
            "currency": "SOS",
            "boost_level": boost_level,
            "duration_days": duration_days,
        },
        "next_step": f"Complete payment via {payment_method}",
    }


# ============= WEBHOOK: PAYMENT SUCCESS (M-Pesa callback) =============

@router.post("/webhooks/payment-success")
async def on_featured_listing_payment_success(
    featured_listing_id: int,
    payment_reference: str,
    amount_paid: float,
    db: Session = Depends(get_db),
):
    """
    Called when M-Pesa/Stripe payment succeeds.

    Steps:
    1. Update FeaturedListing status to "active"
    2. Set expires_at date
    3. Update Listing boost_level
    4. Publish success event
    5. Notify seller (email + SMS confirmation)
    """

    featured = db.query(FeaturedListing).filter(
        FeaturedListing.id == featured_listing_id
    ).first()

    if not featured:
        raise HTTPException(status_code=404, detail="Featured listing not found")

    featured.payment_status = "success"
    featured.status = "active"
    featured.payment_reference = payment_reference
    featured.activated_at = datetime.utcnow()
    featured.expires_at = datetime.utcnow() + timedelta(days=featured.duration_days)
    db.commit()

    # Update listing boost level
    listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()
    boost_map = {"basic": 1, "vip": 2, "diamond": 3}
    listing.boost_level = boost_map.get(featured.boost_level, 0)
    listing.boost_expires_at = featured.expires_at
    db.commit()

    logger.info(
        f"Featured listing payment successful",
        extra={
            "featured_id": featured_listing_id,
            "amount": amount_paid,
            "reference": payment_reference,
        }
    )

    # Publish payment success
    await publish_payment_event(
        event_type="featured_listing.payment_success",
        payload={
            "featured_listing_id": str(featured_listing_id),
            "listing_id": str(featured.listing_id),
            "seller_id": str(featured.owner_id),
            "amount": amount_paid,
            "expires_at": featured.expires_at.isoformat(),
        },
        order_id=str(featured_listing_id),
        user_id=str(featured.owner_id),
    )

    # Notify seller
    seller = db.query(User).filter(User.id == featured.owner_id).first()
    listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()

    await publish_notification_dispatch(
        user_id=str(featured.owner_id),
        event_type="payments.featured_listing.success",
        channels=["email", "sms", "push"],
        template="feature_listing_payment_confirmed",
        data={
            "listing_title": listing.title_en,
            "boost_level": featured.boost_level,
            "amount": amount_paid,
            "expires_date": featured.expires_at.strftime("%B %d, %Y"),
            "views_since_payment": 0,  # Will update later
        },
    )

    return {"status": "activated"}


# ============= WEBHOOK: PAYMENT FAILED =============

@router.post("/webhooks/payment-failed")
async def on_featured_listing_payment_failed(
    featured_listing_id: int,
    failure_reason: str,
    db: Session = Depends(get_db),
):
    """
    Called when payment fails.

    Steps:
    1. Update payment_status to "failed"
    2. Keep featured listing as "pending" (allow retry)
    3. Publish failure event
    4. Notify seller to retry
    """

    featured = db.query(FeaturedListing).filter(
        FeaturedListing.id == featured_listing_id
    ).first()

    if not featured:
        raise HTTPException(status_code=404, detail="Featured listing not found")

    featured.payment_status = "failed"
    db.commit()

    logger.warning(
        f"Featured listing payment failed",
        extra={
            "featured_id": featured_listing_id,
            "reason": failure_reason,
        }
    )

    # Publish failure event
    await publish_payment_event(
        event_type="featured_listing.payment_failed",
        payload={
            "featured_listing_id": str(featured_listing_id),
            "listing_id": str(featured.listing_id),
            "failure_reason": failure_reason,
        },
        order_id=str(featured_listing_id),
        user_id=str(featured.owner_id),
    )

    # Notify seller to retry
    seller = db.query(User).filter(User.id == featured.owner_id).first()
    listing = db.query(Listing).filter(Listing.id == featured.listing_id).first()

    await publish_notification_dispatch(
        user_id=str(featured.owner_id),
        event_type="payments.featured_listing.failed",
        channels=["email", "sms", "push"],
        template="feature_listing_payment_failed",
        data={
            "listing_title": listing.title_en,
            "amount": featured.amount_paid,
            "failure_reason": failure_reason,
            "retry_link": f"https://app.suqafuran.com/listings/{featured.listing_id}/feature",
        },
    )

    return {"status": "failed", "reason": failure_reason}


# ============= HELPER FUNCTIONS =============

async def upload_image_to_s3(file: UploadFile) -> str:
    """Upload image to S3 and return URL."""
    # TODO: Implement S3 upload
    # For now, return mock URL
    import uuid
    file_id = str(uuid.uuid4())
    return f"https://s3.suqafuran.com/listings/{file_id}.jpg"


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Verify user is an admin."""
    if current_user.role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
