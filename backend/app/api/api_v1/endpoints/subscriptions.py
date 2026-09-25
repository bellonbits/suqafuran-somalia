"""
Seller subscription management endpoints.
Handles subscription creation, billing, and feature access.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Body, Query
from sqlmodel import Session, select
from typing import Optional

from app.db.session import get_db
from app.models import (
    SellerSubscription,
    SubscriptionPlan,
    SellerBilling,
    SellerFeatureAccess,
    BillingFrequency,
    BillingStatus,
)
from app.services.subscription_service import subscription_service
from app.core.logging_config import get_logger
from app.api.deps import get_current_user

logger = get_logger("subscriptions_api")

router = APIRouter(tags=["subscriptions"])


@router.get("/subscriptions/plans")
async def get_subscription_plans(session: Session = Depends(get_db)):
    """Get all available subscription plans."""
    plans = session.exec(
        select(SubscriptionPlan).where(SubscriptionPlan.is_active == True)
    ).all()

    return [
        {
            "id": plan.id,
            "name": plan.name,
            "display_name": plan.display_name,
            "description": plan.description,
            "monthly_price": plan.monthly_price,
            "annual_price": plan.annual_price,
            "trial_days": plan.trial_days,
            "features": {
                "max_products": plan.max_products,
                "has_analytics": plan.has_analytics,
                "has_verified_badge": plan.has_verified_badge,
                "has_priority_ranking": plan.has_priority_ranking,
                "has_custom_branding": plan.has_custom_branding,
                "has_bulk_import": plan.has_bulk_import,
                "has_marketing_codes": plan.has_marketing_codes,
                "has_staff_accounts": plan.has_staff_accounts,
                "max_staff_accounts": plan.max_staff_accounts,
                "has_priority_support": plan.has_priority_support,
            },
        }
        for plan in plans
    ]


@router.get("/subscriptions/sellers/{seller_id}/current")
async def get_seller_subscription(
    seller_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get current subscription for a seller."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    subscription = session.exec(
        select(SellerSubscription).where(SellerSubscription.seller_id == seller_id)
    ).first()

    if not subscription:
        return {
            "status": "no_subscription",
            "plan": "free",
            "trial_active": False,
        }

    plan = session.exec(
        select(SubscriptionPlan).where(SubscriptionPlan.id == subscription.plan_id)
    ).first()

    return {
        "id": subscription.id,
        "plan_id": subscription.plan_id,
        "plan_name": plan.name if plan else "unknown",
        "billing_frequency": subscription.billing_frequency,
        "status": subscription.status,
        "is_active": subscription.is_active,
        "trial_active": subscription.is_trial_active,
        "trial_ends_at": subscription.trial_ends_at,
        "current_period_start": subscription.current_period_start,
        "current_period_end": subscription.current_period_end,
        "renews_at": subscription.renews_at,
        "cancelled_at": subscription.cancelled_at,
    }


@router.post("/subscriptions/sellers/{seller_id}/start-trial")
async def start_trial_subscription(
    seller_id: int,
    payload: dict = Body(...),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Start 7-day free trial for Pro plan."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if already has subscription
    existing = session.exec(
        select(SellerSubscription).where(SellerSubscription.seller_id == seller_id)
    ).first()

    if existing and existing.is_active:
        raise HTTPException(status_code=400, detail="Seller already has active subscription")

    # Get plan (from payload or default to starter/pro)
    plan_id = payload.get("plan_id")
    if plan_id:
        plan = session.exec(
            select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
        ).first()
    else:
        # Default to starter plan (has trial)
        plan = session.exec(
            select(SubscriptionPlan).where(
                (SubscriptionPlan.name == "starter") | (SubscriptionPlan.name == "pro")
            )
        ).first()

    if not plan:
        raise HTTPException(status_code=500, detail="Trial plan not configured")

    # Create trial subscription
    subscription = subscription_service.create_subscription(
        seller_id=seller_id,
        plan_id=plan.id,
        billing_frequency=BillingFrequency.MONTHLY,
        billing_id=None,  # No billing for trial
        is_trial=True,
        session=session,
    )

    logger.info(f"Trial started for seller {seller_id}")

    return {
        "status": "success",
        "subscription_id": subscription.id,
        "trial_ends_at": subscription.trial_ends_at,
        "message": "7-day trial started! Upgrade anytime before it expires.",
    }


@router.post("/subscriptions/sellers/{seller_id}/upgrade")
async def upgrade_to_paid(
    seller_id: int,
    payload: dict = Body(...),
    current_user = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    session: Session = Depends(get_db),
):
    """
    Upgrade to paid plan. Initiates M-Pesa STK push.
    payload: {
        "plan_id": 1,
        "billing_frequency": "monthly" | "annual",
        "phone_number": "254712345678"
    }
    """

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    plan_id = payload.get("plan_id")
    billing_frequency = payload.get("billing_frequency", "monthly")
    phone_number = payload.get("phone_number")

    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number required")

    # Get plan
    plan = session.exec(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Calculate amount
    amount_kes = (
        plan.monthly_price
        if billing_frequency == "monthly"
        else plan.annual_price
    )

    if amount_kes <= 0:
        raise HTTPException(status_code=400, detail="Plan is free")

    # Initiate M-Pesa payment
    result = subscription_service.initiate_payment(
        seller_id=seller_id,
        phone_number=phone_number,
        amount_kes=amount_kes,
        plan_id=plan_id,
        billing_frequency=BillingFrequency(billing_frequency),
        session=session,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))

    logger.info(f"Payment initiated for seller {seller_id}: {result['checkout_request_id']}")

    return {
        "status": "payment_initiated",
        "checkout_request_id": result["checkout_request_id"],
        "billing_id": result["billing_id"],
        "message": "STK push sent to your phone. Enter your M-Pesa PIN to confirm.",
    }


@router.post("/subscriptions/mpesa-callback")
async def handle_mpesa_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_db),
):
    """
    M-Pesa callback endpoint.
    Receives payment confirmation from Safaricom.
    """

    try:
        body = await request.json()
        logger.info(f"M-Pesa callback received: {body}")

        # Process callback
        success = subscription_service.handle_mpesa_callback(body, session)

        return {"ResultCode": 0, "ResultDesc": "Callback processed"}

    except Exception as e:
        logger.error(f"Callback processing error: {e}")
        return {"ResultCode": 1, "ResultDesc": "Error processing callback"}


@router.post("/subscriptions/sellers/{seller_id}/verify-payment")
async def verify_payment(
    seller_id: int,
    payload: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Manually verify payment status.
    payload: { "checkout_request_id": "..." }
    """

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    checkout_id = payload.get("checkout_request_id")

    try:
        result = subscription_service.verify_payment(checkout_id, session)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subscriptions/sellers/{seller_id}/cancel")
async def cancel_subscription(
    seller_id: int,
    payload: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Cancel subscription."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    subscription = session.exec(
        select(SellerSubscription).where(SellerSubscription.seller_id == seller_id).where(
            SellerSubscription.is_active == True
        )
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription")

    subscription.is_active = False
    subscription.status = BillingStatus.CANCELLED
    subscription.cancelled_at = subscription.cancelled_at or None
    reason = payload.get("reason", "User requested cancellation")
    subscription.cancellation_reason = reason

    session.add(subscription)
    session.commit()

    logger.info(f"Subscription cancelled for seller {seller_id}: {reason}")

    return {"status": "cancelled", "message": "Subscription cancelled successfully"}


@router.get("/subscriptions/sellers/{seller_id}/features")
async def get_seller_features(
    seller_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get feature access for a seller."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    features = subscription_service.get_seller_features(seller_id, session)

    if not features:
        # Return free tier features
        return {
            "plan": "free",
            "max_products": 30,
            "has_analytics": False,
            "has_verified_badge": False,
            "has_priority_ranking": False,
            "has_custom_branding": False,
            "has_bulk_import": False,
            "has_marketing_codes": False,
            "has_staff_accounts": False,
            "has_priority_support": False,
        }

    return {
        "plan": "pro",
        "max_products": features.max_products,
        "has_analytics": features.has_analytics,
        "has_verified_badge": features.has_verified_badge,
        "has_priority_ranking": features.has_priority_ranking,
        "has_custom_branding": features.has_custom_branding,
        "has_bulk_import": features.has_bulk_import,
        "has_marketing_codes": features.has_marketing_codes,
        "has_staff_accounts": features.has_staff_accounts,
        "has_priority_support": features.has_priority_support,
    }


# ADMIN ENDPOINTS
@router.get("/admin/subscriptions/stats")
async def get_subscription_stats(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get subscription metrics for admin dashboard."""

    # Verify admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    # Get all subscriptions with plans
    all_subs = session.exec(select(SellerSubscription)).all()
    active_subs = [s for s in all_subs if s.is_active]

    # Calculate stats using plan_id
    total_revenue = 0
    monthly_revenue = 0
    for s in active_subs:
        if s.plan_id:
            plan = session.get(SubscriptionPlan, s.plan_id)
            if plan:
                if s.billing_frequency == BillingFrequency.ANNUAL:
                    total_revenue += plan.monthly_price * 12
                else:
                    total_revenue += plan.monthly_price
                monthly_revenue += plan.monthly_price

    tier_distribution = {}
    for plan_name in ["free", "starter", "business", "enterprise"]:
        plan = session.exec(
            select(SubscriptionPlan).where(SubscriptionPlan.name == plan_name)
        ).first()
        if plan:
            count = len([s for s in all_subs if s.plan_id == plan.id])
            tier_distribution[plan_name] = count

    return {
        "total_subscriptions": len(all_subs),
        "active_subscriptions": len(active_subs),
        "total_revenue_monthly": monthly_revenue,
        "total_revenue_annual": total_revenue,
        "avg_arpu": monthly_revenue / max(len(active_subs), 1),
        "tier_distribution": tier_distribution,
        "trial_conversions": len([s for s in active_subs if s.trial_ends_at]),
        "churn_rate": len([s for s in all_subs if not s.is_active and s.cancelled_at]) / max(len(all_subs), 1) * 100,
    }


@router.get("/admin/subscriptions/list")
async def list_all_subscriptions(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get list of all subscriptions for admin."""

    # Verify admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    from app.models.business import Business
    from app.models.user import User
    from app.models.seller_profile import SellerProfile

    subs = session.exec(select(SellerSubscription)).all()

    result = []
    for s in subs:
        plan = session.get(SubscriptionPlan, s.plan_id) if s.plan_id else None

        # Get shop name from SellerProfile > Business > User full_name
        shop_name = "Unknown Shop"
        seller_profile = session.exec(select(SellerProfile).where(SellerProfile.seller_id == s.seller_id)).first()
        if seller_profile and seller_profile.shop_name:
            shop_name = seller_profile.shop_name
        else:
            business = session.exec(select(Business).where(Business.owner_id == s.seller_id)).first()
            if business:
                shop_name = business.name
            else:
                user = session.get(User, s.seller_id)
                if user and user.full_name:
                    shop_name = user.full_name

        result.append({
            "seller_id": s.seller_id,
            "shop_name": shop_name,
            "plan_name": plan.name if plan else "unknown",
            "monthly_price": plan.monthly_price if plan else 0,
            "status": s.status,
            "created_at": s.created_at,
            "trial_ends_at": s.trial_ends_at,
            "renews_at": s.renews_at,
        })

    return {"subscriptions": result}


@router.post("/admin/apply")
async def admin_apply_subscription(
    seller_id: int,
    plan_id: int = Body(...),
    reason: str = Body(...),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Admin manually apply subscription to seller (for failed payments, manual grants, etc)."""

    # Verify admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    # Get plan
    plan = session.get(SubscriptionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Check if seller already has active subscription
    existing = session.exec(
        select(SellerSubscription).where(
            (SellerSubscription.seller_id == seller_id) &
            (SellerSubscription.is_active == True)
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Seller already has active subscription")

    # Create subscription
    from datetime import datetime, timedelta
    now = datetime.utcnow()

    subscription = SellerSubscription(
        seller_id=seller_id,
        plan_id=plan_id,
        status="active",
        is_active=True,
        trial_active=False,
        created_at=now,
        renews_at=now + timedelta(days=30),  # 30-day subscription
    )

    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    logger.info(f"Admin applied {plan.name} subscription to seller {seller_id}. Reason: {reason}")

    return {
        "status": "success",
        "message": f"Applied {plan.display_name} subscription to seller {seller_id}",
        "subscription_id": subscription.id,
        "seller_id": seller_id,
        "plan": plan.display_name,
        "renews_at": subscription.renews_at,
    }


@router.get("/admin/shops/search")
async def search_shops(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
    q: str = Query(default=""),
):
    """Search shops by business name for admin subscription assignment."""

    # Verify admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    from app.models.user import User
    from sqlalchemy import func

    query = select(User).where(User.business_name.isnot(None))

    if q:
        search_term = f"%{q.lower()}%"
        query = query.where(func.lower(User.business_name).like(search_term))

    shops = session.exec(query.limit(10)).all()

    return [
        {
            "id": shop.id,
            "business_name": shop.business_name,
            "full_name": shop.full_name,
            "email": shop.email,
            "phone": shop.phone,
            "is_verified": shop.is_verified,
            "is_active": shop.is_active,
        }
        for shop in shops
    ]


@router.post("/subscriptions/sellers/{seller_id}/verification/auto-verify")
async def auto_verify_seller(
    seller_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Auto-verify seller if they meet any of these criteria:
    1. Have an approved VerificationRequest (passed document verification)
    2. Are existing shop owner with listings

    No need to re-verify - they're already vetted by the platform.
    """
    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Try to auto-verify
    result = subscription_service.auto_verify_existing_sellers(seller_id, session)

    if result["auto_verified"]:
        return {
            "status": "verified",
            "message": f"Auto-verified ({result['reason']})",
            "auto_verified": True,
            "reason": result["reason"],
            "verification_data": result["verification_data"],
        }
    else:
        return {
            "status": "needs_verification",
            "message": result["reason"],
            "auto_verified": False,
            "reason": result["reason"],
            "verification_data": result["verification_data"],
        }


@router.get("/subscriptions/sellers/{seller_id}/verification/status")
async def get_verification_status(
    seller_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Get verification status for seller.
    Auto-verifies if eligible based on existing verification or shop listings.
    """
    from app.models import IdentityVerification

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    verification = session.exec(
        select(IdentityVerification).where(IdentityVerification.seller_id == seller_id)
    ).first()

    if not verification:
        # Try to auto-verify if not yet done
        result = subscription_service.auto_verify_existing_sellers(seller_id, session)
        verification = session.exec(
            select(IdentityVerification).where(IdentityVerification.seller_id == seller_id)
        ).first()

    if not verification:
        return {
            "status": "not_started",
            "is_verified": False,
            "message": "Please complete verification to get the verified badge",
            "auto_verified": False,
        }

    return {
        "status": verification.status,
        "is_verified": verification.status == "approved",
        "verified_at": verification.verified_at,
        "email_verified": verification.email_verified,
        "phone_verified": verification.phone_verified,
        "rejection_reason": verification.rejection_reason,
        "auto_verified": verification.status == "approved",
        "id_type": verification.id_type,
    }
