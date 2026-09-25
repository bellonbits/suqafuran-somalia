"""
Retention Celery Tasks — Suqafuran
====================================
Scheduled tasks that run the post-purchase retention funnel.

Beat schedule additions needed in app/tasks/celery_app.py:

    # Check for orders that need cross-sell email (7 days post-delivery)
    "retention-cross-sell": {
        "task": "app.tasks.retention_tasks.send_cross_sell_reminders",
        "schedule": crontab(hour=10, minute=0),      # Daily 10 AM UTC
    },
    # Replenishment reminders for consumables (14 days post-delivery)
    "retention-replenishment": {
        "task": "app.tasks.retention_tasks.send_replenishment_reminders",
        "schedule": crontab(hour=10, minute=30),
    },
    # Win-back: "we miss you" (45 days no purchase)
    "retention-winback-soft": {
        "task": "app.tasks.retention_tasks.send_winback_soft",
        "schedule": crontab(hour=11, minute=0),
    },
    # Win-back: secret coupon (90 days no purchase)
    "retention-winback-offer": {
        "task": "app.tasks.retention_tasks.send_winback_offer",
        "schedule": crontab(hour=11, minute=30),
    },
    # Purchase anniversary coupons — daily at 9 AM UTC
    "retention-anniversary": {
        "task": "app.tasks.retention_tasks.send_anniversary_coupons",
        "schedule": crontab(hour=9, minute=0),
    },
"""

import random
import string
import logging
from datetime import datetime, timedelta
from typing import Optional

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


# ─────────────────────────────────────────────────────────────
#  Helper: generate a readable coupon code
# ─────────────────────────────────────────────────────────────

def _gen_coupon(prefix: str = "SQF", length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return f"{prefix}-{''.join(random.choices(chars, k=length))}"


# ─────────────────────────────────────────────────────────────
#  Immediate dispatch tasks (called from payment endpoint)
# ─────────────────────────────────────────────────────────────

@shared_task(
    name="app.tasks.retention_tasks.notify_order_confirmed",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="notifications",
)
def notify_order_confirmed(
    self,
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    buyer_phone: str,
    order_id: str,
    seller_name: str,
    items_summary: str,
    total_amount: float,
    currency: str = "KSh",
):
    """
    Fire immediately after payment confirmation.
    Sends the buyer thank-you email + SMS.
    """
    try:
        from app.services.post_purchase_service import send_order_confirmation
        from app.core.config import settings

        order_url = f"{settings.FRONTEND_URL}/orders/{order_id}"

        ok = send_order_confirmation(
            user_id=user_id,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            buyer_phone=buyer_phone,
            order_id=order_id,
            seller_name=seller_name,
            items_summary=items_summary,
            total_amount=total_amount,
            order_url=order_url,
            currency=currency,
        )
        logger.info(f"[RetentionTask] notify_order_confirmed: order={order_id}, ok={ok}")
        return {"ok": ok, "order_id": order_id}
    except Exception as exc:
        logger.error(f"[RetentionTask] notify_order_confirmed failed: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    name="app.tasks.retention_tasks.notify_seller_new_order",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="notifications",
)
def notify_seller_new_order(
    self,
    *,
    seller_user_id: int,
    seller_name: str,
    seller_email: str,
    seller_phone: str,
    order_id: str,
    buyer_name: str,
    items_summary: str,
    total_amount: float,
    fulfillment_type: str,
    delivery_address: str,
    currency: str = "KSh",
):
    """Alert seller of a new incoming order — dispatched immediately on payment."""
    try:
        from app.services.post_purchase_service import send_seller_new_order_alert
        from app.core.config import settings

        order_dashboard_url = f"{settings.FRONTEND_URL}/seller/orders/{order_id}"

        ok = send_seller_new_order_alert(
            seller_user_id=seller_user_id,
            seller_name=seller_name,
            seller_email=seller_email,
            seller_phone=seller_phone,
            order_id=order_id,
            buyer_name=buyer_name,
            items_summary=items_summary,
            total_amount=total_amount,
            fulfillment_type=fulfillment_type,
            delivery_address=delivery_address,
            order_dashboard_url=order_dashboard_url,
            currency=currency,
        )
        logger.info(f"[RetentionTask] notify_seller_new_order: order={order_id}, ok={ok}")
        return {"ok": ok}
    except Exception as exc:
        logger.error(f"[RetentionTask] notify_seller_new_order failed: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    name="app.tasks.retention_tasks.notify_order_dispatched",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="notifications",
)
def notify_order_dispatched(
    self,
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    buyer_phone: str,
    order_id: str,
    seller_name: str,
    estimated_delivery: str = "Within 24 hours",
):
    """Triggered when seller marks order as dispatched/in_transit."""
    try:
        from app.services.post_purchase_service import send_order_dispatched
        from app.core.config import settings

        tracking_url = f"{settings.FRONTEND_URL}/orders/{order_id}"

        ok = send_order_dispatched(
            user_id=user_id,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            buyer_phone=buyer_phone,
            order_id=order_id,
            seller_name=seller_name,
            estimated_delivery=estimated_delivery,
            tracking_url=tracking_url,
        )
        logger.info(f"[RetentionTask] notify_order_dispatched: order={order_id}, ok={ok}")
        return {"ok": ok}
    except Exception as exc:
        logger.error(f"[RetentionTask] notify_order_dispatched failed: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    name="app.tasks.retention_tasks.notify_order_delivered",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="notifications",
)
def notify_order_delivered(
    self,
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    order_id: str,
    seller_name: str,
    listing_id: Optional[int] = None,
):
    """Triggered when order is marked delivered. Requests a review."""
    try:
        from app.services.post_purchase_service import send_order_delivered
        from app.core.config import settings

        review_url = f"{settings.FRONTEND_URL}/orders/{order_id}/review"
        reorder_url = f"{settings.FRONTEND_URL}/listings/{listing_id}" if listing_id else settings.FRONTEND_URL

        ok = send_order_delivered(
            user_id=user_id,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            order_id=order_id,
            seller_name=seller_name,
            review_url=review_url,
            reorder_url=reorder_url,
        )
        logger.info(f"[RetentionTask] notify_order_delivered: order={order_id}, ok={ok}")
        return {"ok": ok}
    except Exception as exc:
        logger.error(f"[RetentionTask] notify_order_delivered failed: {exc}")
        raise self.retry(exc=exc)


# ─────────────────────────────────────────────────────────────
#  Beat-scheduled tasks (run daily via Celery beat)
# ─────────────────────────────────────────────────────────────

@shared_task(
    name="app.tasks.retention_tasks.send_cross_sell_reminders",
    queue="default",
)
def send_cross_sell_reminders():
    """
    Daily: find orders delivered ~7 days ago and send cross-sell email.
    Skips users who already received a cross-sell for that order.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.order import Order, OrderStatus
    from app.models.user import User
    from app.models.email_log import EmailLog
    from app.services.post_purchase_service import send_cross_sell_email

    now = datetime.utcnow()
    window_start = now - timedelta(days=8)
    window_end = now - timedelta(days=6)

    sent = 0
    with Session(engine) as db:
        orders = db.exec(
            select(Order).where(
                Order.status == OrderStatus.delivered,
                Order.delivered_at >= window_start,
                Order.delivered_at <= window_end,
            )
        ).all()

        for order in orders:
            # Skip if already sent cross-sell for this order
            already_sent = db.exec(
                select(EmailLog).where(
                    EmailLog.user_id == order.customer_id,
                    EmailLog.email_type == "cross_sell",
                    EmailLog.metadata_json.contains(order.id),
                )
            ).first()
            if already_sent:
                continue

            buyer = db.get(User, order.customer_id)
            if not buyer or not buyer.email:
                continue

            # Build simple items summary from order items
            items_summary = ", ".join([i.product_title for i in order.items[:3]])

            # TODO: plug in real recommendation engine;
            # for now send them to the search page
            from app.core.config import settings
            recommendations = [
                {
                    "title": "Explore more products",
                    "price": 0,
                    "url": settings.FRONTEND_URL,
                    "image_url": "https://suqafuran.com/icon1.png",
                }
            ]

            send_cross_sell_email(
                user_id=buyer.id,
                buyer_name=buyer.full_name or "Valued Customer",
                buyer_email=buyer.email,
                order_id=str(order.id),
                original_product=items_summary,
                recommendations=recommendations,
            )
            sent += 1

    logger.info(f"[RetentionTask] send_cross_sell_reminders: sent={sent}")
    return {"sent": sent}


@shared_task(
    name="app.tasks.retention_tasks.send_replenishment_reminders",
    queue="default",
)
def send_replenishment_reminders():
    """
    Daily: find consumable-product orders delivered ~14 days ago
    and send a replenishment nudge.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.order import Order, OrderStatus, OrderItem
    from app.models.listing import Listing
    from app.models.user import User
    from app.models.email_log import EmailLog
    from app.services.post_purchase_service import send_replenishment_reminder
    from app.core.config import settings

    now = datetime.utcnow()
    window_start = now - timedelta(days=15)
    window_end = now - timedelta(days=13)

    sent = 0
    with Session(engine) as db:
        orders = db.exec(
            select(Order).where(
                Order.status == OrderStatus.delivered,
                Order.delivered_at >= window_start,
                Order.delivered_at <= window_end,
            )
        ).all()

        for order in orders:
            already_sent = db.exec(
                select(EmailLog).where(
                    EmailLog.user_id == order.customer_id,
                    EmailLog.email_type == "replenishment_reminder",
                    EmailLog.metadata_json.contains(str(order.id)),
                )
            ).first()
            if already_sent:
                continue

            buyer = db.get(User, order.customer_id)
            if not buyer or not buyer.email:
                continue

            for item in order.items:
                listing = db.get(Listing, item.product_id)
                # Only replenish consumable listings
                if not listing or not getattr(listing, "is_consumable", False):
                    continue

                send_replenishment_reminder(
                    user_id=buyer.id,
                    buyer_name=buyer.full_name or "Valued Customer",
                    buyer_email=buyer.email,
                    product_title=item.product_title,
                    product_url=f"{settings.FRONTEND_URL}/listings/{listing.id}",
                    product_image_url=getattr(listing, "thumbnail_url", "") or "",
                    price=item.unit_price,
                    days_since_purchase=14,
                )
                sent += 1
                break  # One replenishment email per order max

    logger.info(f"[RetentionTask] send_replenishment_reminders: sent={sent}")
    return {"sent": sent}


@shared_task(
    name="app.tasks.retention_tasks.send_winback_soft",
    queue="default",
)
def send_winback_soft():
    """
    Daily: users with no purchase in 44–46 days get a soft "we miss you" email.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.order import Order, OrderStatus
    from app.models.user import User
    from app.models.email_log import EmailLog
    from app.services.post_purchase_service import send_win_back_miss_you
    from app.core.config import settings
    from sqlalchemy import func

    now = datetime.utcnow()
    lapse_start = now - timedelta(days=46)
    lapse_end = now - timedelta(days=44)

    sent = 0
    with Session(engine) as db:
        # Users whose most recent completed order was 44–46 days ago
        subq = (
            select(Order.customer_id, func.max(Order.created_at).label("last_order"))
            .where(Order.status.in_([OrderStatus.delivered, OrderStatus.completed]))
            .group_by(Order.customer_id)
            .subquery()
        )
        rows = db.exec(
            select(subq.c.customer_id, subq.c.last_order).where(
                subq.c.last_order >= lapse_start,
                subq.c.last_order <= lapse_end,
            )
        ).all()

        for row in rows:
            user_id = row[0]
            already_sent = db.exec(
                select(EmailLog).where(
                    EmailLog.user_id == user_id,
                    EmailLog.email_type == "win_back_miss_you",
                    EmailLog.sent_at >= now - timedelta(days=60),
                )
            ).first()
            if already_sent:
                continue

            buyer = db.get(User, user_id)
            if not buyer or not buyer.email:
                continue

            # Last purchased product
            last_order = db.exec(
                select(Order)
                .where(Order.customer_id == user_id)
                .order_by(Order.created_at.desc())
            ).first()
            last_product = None
            if last_order and last_order.items:
                last_product = last_order.items[0].product_title

            send_win_back_miss_you(
                user_id=buyer.id,
                buyer_name=buyer.full_name or "Valued Customer",
                buyer_email=buyer.email,
                last_purchase_product=last_product,
                days_inactive=45,
                browse_url=settings.FRONTEND_URL,
            )
            sent += 1

    logger.info(f"[RetentionTask] send_winback_soft: sent={sent}")
    return {"sent": sent}


@shared_task(
    name="app.tasks.retention_tasks.send_winback_offer",
    queue="default",
)
def send_winback_offer():
    """
    Daily: users with no purchase in 89–91 days get a secret 10% coupon.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.order import Order, OrderStatus
    from app.models.user import User
    from app.models.email_log import EmailLog
    from app.services.post_purchase_service import send_win_back_secret_offer
    from app.core.config import settings
    from sqlalchemy import func

    now = datetime.utcnow()
    lapse_start = now - timedelta(days=91)
    lapse_end = now - timedelta(days=89)

    sent = 0
    with Session(engine) as db:
        subq = (
            select(Order.customer_id, func.max(Order.created_at).label("last_order"))
            .where(Order.status.in_([OrderStatus.delivered, OrderStatus.completed]))
            .group_by(Order.customer_id)
            .subquery()
        )
        rows = db.exec(
            select(subq.c.customer_id, subq.c.last_order).where(
                subq.c.last_order >= lapse_start,
                subq.c.last_order <= lapse_end,
            )
        ).all()

        for row in rows:
            user_id = row[0]
            already_sent = db.exec(
                select(EmailLog).where(
                    EmailLog.user_id == user_id,
                    EmailLog.email_type == "win_back_secret_offer",
                    EmailLog.sent_at >= now - timedelta(days=90),
                )
            ).first()
            if already_sent:
                continue

            buyer = db.get(User, user_id)
            if not buyer or not buyer.email:
                continue

            coupon = _gen_coupon("BACK")

            # TODO: persist this coupon to discount_codes table so checkout can apply it
            # from app.services.discount_code_service import discount_code_service
            # discount_code_service.create(code=coupon, discount_percent=10, valid_days=2, user_id=user_id)

            send_win_back_secret_offer(
                user_id=buyer.id,
                buyer_name=buyer.full_name or "Valued Customer",
                buyer_email=buyer.email,
                coupon_code=coupon,
                discount_percent=10,
                expiry_hours=48,
                shop_url=settings.FRONTEND_URL,
            )
            sent += 1

    logger.info(f"[RetentionTask] send_winback_offer: sent={sent}")
    return {"sent": sent}


@shared_task(
    name="app.tasks.retention_tasks.send_anniversary_coupons",
    queue="default",
)
def send_anniversary_coupons():
    """
    Daily: find users whose first purchase anniversary is today and send a gift coupon.
    """
    from sqlmodel import Session, select
    from app.db.session import engine
    from app.models.order import Order, OrderStatus
    from app.models.user import User
    from app.models.email_log import EmailLog
    from app.services.post_purchase_service import send_anniversary_coupon
    from app.core.config import settings
    from sqlalchemy import func, extract

    now = datetime.utcnow()
    today_month = now.month
    today_day = now.day

    sent = 0
    with Session(engine) as db:
        # First order per user
        subq = (
            select(Order.customer_id, func.min(Order.created_at).label("first_order"))
            .where(Order.status.in_([OrderStatus.delivered, OrderStatus.completed]))
            .group_by(Order.customer_id)
            .subquery()
        )
        rows = db.exec(
            select(subq.c.customer_id, subq.c.first_order).where(
                extract("month", subq.c.first_order) == today_month,
                extract("day", subq.c.first_order) == today_day,
            )
        ).all()

        for row in rows:
            user_id, first_order_date = row[0], row[1]

            # Only send if at least 1 full year has passed
            years = now.year - first_order_date.year
            if years < 1:
                continue

            already_sent = db.exec(
                select(EmailLog).where(
                    EmailLog.user_id == user_id,
                    EmailLog.email_type == "anniversary_coupon",
                    EmailLog.sent_at >= now - timedelta(days=30),
                )
            ).first()
            if already_sent:
                continue

            buyer = db.get(User, user_id)
            if not buyer or not buyer.email:
                continue

            coupon = _gen_coupon("ANNIV")
            discount = 10 if years == 1 else (15 if years < 3 else 20)

            send_anniversary_coupon(
                user_id=buyer.id,
                buyer_name=buyer.full_name or "Valued Customer",
                buyer_email=buyer.email,
                years=years,
                coupon_code=coupon,
                discount_percent=discount,
                shop_url=settings.FRONTEND_URL,
            )
            sent += 1

    logger.info(f"[RetentionTask] send_anniversary_coupons: sent={sent}")
    return {"sent": sent}
