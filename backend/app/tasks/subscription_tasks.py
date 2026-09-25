"""
Subscription lifecycle background tasks:
- expire_ended_subscriptions: downgrades sellers whose paid subscription or
  trial period has ended back to the free plan, and notifies them by email
  and in-app notification (runs every 15 min via beat).
"""
from datetime import datetime
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(name="app.tasks.subscription_tasks.expire_ended_subscriptions")
def expire_ended_subscriptions():
    """
    Beat task: find active subscriptions/trials whose period has ended,
    downgrade the seller's feature access to the free plan, and notify them.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.subscription import (
        SellerSubscription, SubscriptionPlan, SellerFeatureAccess, BillingStatus,
    )
    from app.models.notification import Notification
    from app.models.user import User
    from app.services.email_service import email_service

    now = datetime.utcnow()

    with Session(engine) as db:
        free_plan = db.exec(select(SubscriptionPlan).where(SubscriptionPlan.name == "free")).first()
        if not free_plan:
            logger.error("No 'free' subscription plan found — cannot downgrade expired subscriptions")
            return

        # Trials that ended without converting to a paid plan
        expired_trials = db.exec(
            select(SellerSubscription).where(
                SellerSubscription.is_active == True,
                SellerSubscription.is_trial_active == True,
                SellerSubscription.trial_ends_at < now,
            )
        ).all()

        # Paid subscriptions whose billing period ended with no renewal
        expired_paid = db.exec(
            select(SellerSubscription).where(
                SellerSubscription.is_active == True,
                SellerSubscription.is_trial_active == False,
                SellerSubscription.status == BillingStatus.ACTIVE,
                SellerSubscription.current_period_end < now,
            )
        ).all()

        for sub in [*expired_trials, *expired_paid]:
            was_trial = sub.is_trial_active
            plan = db.get(SubscriptionPlan, sub.plan_id)
            plan_name = plan.display_name if plan else "Pro"

            sub.status = BillingStatus.EXPIRED
            sub.is_active = False
            sub.is_trial_active = False
            sub.updated_at = now
            db.add(sub)

            # Stop the paid package: drop feature access back to the free plan
            features = db.exec(
                select(SellerFeatureAccess).where(SellerFeatureAccess.seller_id == sub.seller_id)
            ).first()
            if features:
                features.subscription_id = sub.id
                features.has_analytics = free_plan.has_analytics
                features.has_verified_badge = free_plan.has_verified_badge
                features.has_priority_ranking = free_plan.has_priority_ranking
                features.has_custom_branding = free_plan.has_custom_branding
                features.has_bulk_import = free_plan.has_bulk_import
                features.has_marketing_codes = free_plan.has_marketing_codes
                features.has_staff_accounts = free_plan.has_staff_accounts
                features.has_email_support = free_plan.has_email_support
                features.has_priority_support = free_plan.has_priority_support
                features.max_products = free_plan.max_products
                features.max_staff_accounts = free_plan.max_staff_accounts
                features.updated_at = now
                db.add(features)

            db.add(Notification(
                user_id=sub.seller_id,
                type="subscription_ended",
                data={
                    "plan_name": plan_name,
                    "was_trial": was_trial,
                    "message": f"Your {plan_name} {'free trial' if was_trial else 'subscription'} has ended. Renew to keep your premium features.",
                },
            ))

            user = db.get(User, sub.seller_id)
            if user and user.email:
                try:
                    email_service.send_subscription_ended_email(
                        email=user.email,
                        name=user.full_name or "there",
                        plan_name=plan_name,
                        is_trial=was_trial,
                        user_id=user.id,
                    )
                except Exception as exc:
                    logger.warning(f"Failed to send subscription-ended email to seller {sub.seller_id}: {exc}")

        db.commit()
        total = len(expired_trials) + len(expired_paid)
        if total:
            logger.info(
                f"Expired {len(expired_trials)} trials and {len(expired_paid)} paid subscriptions; "
                f"downgraded to free plan and notified sellers"
            )
