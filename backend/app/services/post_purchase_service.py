"""
Post-Purchase Notification Service — Suqafuran
===============================================
Orchestrates the full buyer retention journey after a purchase:

  Step 1: Memorable Experiences
    - Order confirmed  → thank-you email + SMS
    - Seller accepted  → in-app + email update
    - Dispatched       → email + SMS "on the way"
    - Out for delivery → push/SMS
    - Delivered        → email + review request (24h later)

  Step 2: Persuade to Come Back
    - Day 7  → cross-sell email (related products)
    - Day 14 → replenishment reminder (consumables)
    - Day 30 → new arrivals from followed seller

  Step 3: Win Back (triggered by lapse detection)
    - Day 45 → "we miss you" email (recently viewed items)
    - Day 60 → price drop notification
    - Day 90 → secret 10% coupon (48h expiry)

All email sends go through email_service._send_and_log() for
open/click tracking.  SMS goes through sms_service.send_sms().
Heavy tasks are dispatched to Celery to keep the request path fast.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger("post_purchase_service")


# ─────────────────────────────────────────────────────────────
#  Internal helper: send via email_service._send_and_log()
# ─────────────────────────────────────────────────────────────

def _send_email(
    to_email: str,
    subject: str,
    html_body: str,
    email_type: str,
    user_id: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> bool:
    """Thin wrapper around EmailService._send_and_log."""
    try:
        from app.services.email_service import email_service
        return email_service._send_and_log(
            email=to_email,
            subject=subject,
            html_body=html_body,
            email_type=email_type,
            user_id=user_id,
            metadata=metadata,
            preferred_provider="resend",
        )
    except Exception as e:
        logger.error(f"[PostPurchase] _send_email failed for {to_email}: {e}")
        return False


def _send_sms(to_phone: str, message: str) -> bool:
    """Thin wrapper around SMSService.send_sms."""
    try:
        from app.services.sms_service import sms_service
        result = sms_service.send_sms(to_number=to_phone, message=message)
        return result.get("status") == "sent"
    except Exception as e:
        logger.error(f"[PostPurchase] _send_sms failed for {to_phone}: {e}")
        return False


def _base_template(title: str, subtitle: str, content: str) -> str:
    """Re-use the same branded wrapper already used for OTP / reset emails."""
    try:
        from app.services.email_service import email_service
        return email_service._get_base_template(title=title, subtitle=subtitle, content=content)
    except Exception:
        # Minimal fallback
        return f"<html><body><h2>{title}</h2><p>{subtitle}</p>{content}</body></html>"


# ═════════════════════════════════════════════════════════════
#  STEP 1 — MEMORABLE EXPERIENCES
# ═════════════════════════════════════════════════════════════

def send_order_confirmation(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    buyer_phone: str,
    order_id: str,
    seller_name: str,
    items_summary: str,          # e.g. "Samsung Galaxy A15 × 1, Phone Case × 1"
    total_amount: float,
    order_url: str,
    currency: str = "KSh",
) -> bool:
    """
    Sent immediately after payment is confirmed.
    Highest-ROI email in the entire retention funnel (~70% open rate).
    """
    logger.info(f"[PostPurchase] Sending order confirmation: order={order_id}, user={user_id}")

    content = f"""
    <div style="background:#f0fdf4;border-radius:12px;padding:24px 28px;margin:24px 0;border:1px solid #bbf7d0;">
      <p style="margin:0 0 8px;font-size:13px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Order Confirmed ✓</p>
      <p style="margin:0;font-size:22px;font-weight:900;color:#15803d;">#{order_id}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Seller</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;">{seller_name}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Items</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;">{items_summary}</td>
      </tr>
      <tr>
        <td style="padding:14px 0;color:#1e293b;font-size:16px;font-weight:700;">Total Paid</td>
        <td style="padding:14px 0;font-size:20px;font-weight:900;color:#f97316;text-align:right;">{currency} {total_amount:,.0f}</td>
      </tr>
    </table>

    <div style="background:#fff7ed;border-radius:10px;padding:20px 24px;margin:24px 0;border:1px solid #fed7aa;">
      <p style="margin:0 0 6px;font-weight:700;color:#c2410c;font-size:14px;">What happens next?</p>
      <p style="margin:0;font-size:14px;color:#7c3aed;">1. {seller_name} will confirm your order shortly.<br>
         2. You'll get a notification when it's dispatched.<br>
         3. Your item will be delivered to your address.</p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="{order_url}" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;letter-spacing:.3px;">
        Track Your Order →
      </a>
    </div>
    """

    html_body = _base_template(
        title=f"Thank you, {buyer_name}! 🎉",
        subtitle="Your order has been received and is being prepared.",
        content=content,
    )

    ok = _send_email(
        to_email=buyer_email,
        subject=f"Order Confirmed — #{order_id} | Suqafuran",
        html_body=html_body,
        email_type="order_confirmation",
        user_id=user_id,
        metadata={"order_id": order_id, "seller": seller_name, "amount": total_amount},
    )

    # Parallel SMS (short, punchy)
    sms_text = (
        f"Suqafuran: Order #{order_id} confirmed! "
        f"{currency} {total_amount:,.0f} paid. "
        f"{seller_name} will dispatch soon. Track: {order_url}"
    )
    _send_sms(to_phone=buyer_phone, message=sms_text[:160])

    return ok


def send_order_dispatched(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    buyer_phone: str,
    order_id: str,
    seller_name: str,
    estimated_delivery: str,       # e.g. "Today, between 2–5 PM"
    tracking_url: str,
    currency: str = "KSh",
) -> bool:
    """Sent when the seller marks the order as dispatched / in_transit."""
    logger.info(f"[PostPurchase] Sending dispatch notification: order={order_id}")

    content = f"""
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:64px;">🚚</span>
      <p style="margin:12px 0 0;font-size:20px;font-weight:800;color:#1e293b;">Your order is on its way!</p>
      <p style="margin:8px 0 0;color:#64748b;">Estimated delivery: <strong>{estimated_delivery}</strong></p>
    </div>

    <div style="background:#f0f9ff;border-radius:10px;padding:20px 24px;margin:24px 0;border:1px solid #bae6fd;">
      <p style="margin:0 0 4px;font-weight:700;color:#0369a1;">Dispatched by</p>
      <p style="margin:0;font-size:18px;font-weight:800;color:#0c4a6e;">{seller_name}</p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="{tracking_url}" style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Track Live →
      </a>
    </div>
    """

    html_body = _base_template(
        title="Your order is dispatched!",
        subtitle=f"Good news, {buyer_name} — {seller_name} has sent your order.",
        content=content,
    )

    ok = _send_email(
        to_email=buyer_email,
        subject=f"📦 Your Suqafuran order #{order_id} is on its way!",
        html_body=html_body,
        email_type="order_dispatched",
        user_id=user_id,
        metadata={"order_id": order_id},
    )

    _send_sms(
        to_phone=buyer_phone,
        message=f"Suqafuran: Your order #{order_id} is on its way! Est. delivery: {estimated_delivery}. Track: {tracking_url}",
    )

    return ok


def send_order_delivered(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    order_id: str,
    seller_name: str,
    review_url: str,
    reorder_url: str,
) -> bool:
    """
    Sent when the order is marked delivered.
    Includes a review request — the most important post-purchase conversion step.
    """
    logger.info(f"[PostPurchase] Sending delivered + review request: order={order_id}")

    content = f"""
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:64px;">✅</span>
      <p style="margin:12px 0 0;font-size:20px;font-weight:800;color:#1e293b;">Your order has arrived!</p>
    </div>

    <p>We hope you love what you ordered from <strong>{seller_name}</strong>.</p>

    <div style="background:#fefce8;border-radius:12px;padding:28px;margin:28px 0;border:1px solid #fde68a;text-align:center;">
      <p style="margin:0 0 6px;font-size:14px;color:#92400e;font-weight:700;">⭐ How was your experience?</p>
      <p style="margin:0 0 20px;font-size:15px;color:#78350f;">Your review helps other buyers and rewards great sellers.</p>
      <a href="{review_url}" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Leave a Review →
      </a>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="{reorder_url}" style="color:#f97316;font-weight:700;font-size:14px;text-decoration:none;">
        🔄 Order again from {seller_name}
      </a>
    </div>
    """

    html_body = _base_template(
        title=f"Delivered! How was it, {buyer_name}?",
        subtitle="Your Suqafuran order has been delivered.",
        content=content,
    )

    return _send_email(
        to_email=buyer_email,
        subject=f"Your Suqafuran order was delivered — tell us what you think ⭐",
        html_body=html_body,
        email_type="order_delivered_review_request",
        user_id=user_id,
        metadata={"order_id": order_id, "seller": seller_name},
    )


def send_seller_new_order_alert(
    *,
    seller_user_id: int,
    seller_name: str,
    seller_email: str,
    seller_phone: str,
    order_id: str,
    buyer_name: str,
    items_summary: str,
    total_amount: float,
    fulfillment_type: str,         # "delivery" or "pickup"
    delivery_address: str,
    order_dashboard_url: str,
    currency: str = "KSh",
) -> bool:
    """Alert the seller the moment a new order arrives."""
    logger.info(f"[PostPurchase] Alerting seller {seller_user_id} of new order={order_id}")

    fulfillment_label = "🚚 Delivery" if fulfillment_type == "delivery" else "🏪 Pickup"

    content = f"""
    <div style="background:#fef2f2;border-radius:12px;padding:24px 28px;margin:24px 0;border:1px solid #fecaca;">
      <p style="margin:0 0 4px;font-size:13px;color:#dc2626;font-weight:700;text-transform:uppercase;">New Order</p>
      <p style="margin:0;font-size:24px;font-weight:900;color:#991b1b;">#{order_id}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Customer</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;">{buyer_name}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Items</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;">{items_summary}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Fulfillment</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;">{fulfillment_label}</td>
      </tr>
      {'<tr><td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Address</td><td style="padding:10px 0;font-weight:600;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;">' + delivery_address + '</td></tr>' if fulfillment_type == "delivery" else ''}
      <tr>
        <td style="padding:14px 0;color:#1e293b;font-size:16px;font-weight:700;">Your Earnings</td>
        <td style="padding:14px 0;font-size:20px;font-weight:900;color:#16a34a;text-align:right;">{currency} {total_amount * 0.9:,.0f}</td>
      </tr>
    </table>

    <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #bbf7d0;">
      <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">
        ⏱ Please confirm and dispatch as soon as possible to maintain your seller rating.
      </p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="{order_dashboard_url}" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Manage Order →
      </a>
    </div>
    """

    html_body = _base_template(
        title="You have a new order! 🛍️",
        subtitle=f"A customer just placed an order from your shop, {seller_name}.",
        content=content,
    )

    ok = _send_email(
        to_email=seller_email,
        subject=f"New Order #{order_id} — Action Required",
        html_body=html_body,
        email_type="seller_new_order",
        user_id=seller_user_id,
        metadata={"order_id": order_id, "buyer": buyer_name, "amount": total_amount},
    )

    _send_sms(
        to_phone=seller_phone,
        message=f"Suqafuran: New order #{order_id} from {buyer_name}! {currency} {total_amount * 0.9:,.0f} earnings. Confirm now: {order_dashboard_url}",
    )

    return ok


# ═════════════════════════════════════════════════════════════
#  STEP 2 — PERSUADE TO COME BACK  (scheduled via Celery)
# ═════════════════════════════════════════════════════════════

def send_cross_sell_email(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    order_id: str,
    original_product: str,
    recommendations: list[dict],   # [{"title": ..., "price": ..., "url": ..., "image_url": ...}]
    currency: str = "KSh",
) -> bool:
    """
    Sent 7 days after delivery.
    Shows up to 4 related products the buyer might love.
    """
    logger.info(f"[PostPurchase] Sending cross-sell email: user={user_id}, order={order_id}")

    products_html = ""
    for p in recommendations[:4]:
        products_html += f"""
        <td style="width:25%;padding:0 8px;vertical-align:top;">
          <a href="{p.get('url','#')}" style="text-decoration:none;">
            <img src="{p.get('image_url','')}" alt="{p.get('title','')}" style="width:100%;border-radius:8px;margin-bottom:8px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1e293b;">{p.get('title','')}</p>
            <p style="margin:0;font-size:14px;font-weight:800;color:#f97316;">{currency} {p.get('price',0):,.0f}</p>
          </a>
        </td>"""

    content = f"""
    <p>You recently bought <strong>{original_product}</strong> — customers who bought this also loved:</p>

    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <tr>{products_html}</tr>
    </table>

    <div style="text-align:center;margin:32px 0;">
      <a href="{settings.FRONTEND_URL}/search" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Shop More →
      </a>
    </div>
    """

    html_body = _base_template(
        title=f"You might also love these, {buyer_name} 🛍️",
        subtitle="Based on your recent purchase, here are some items we think you'll like.",
        content=content,
    )

    return _send_email(
        to_email=buyer_email,
        subject="People who bought this also loved… | Suqafuran",
        html_body=html_body,
        email_type="cross_sell",
        user_id=user_id,
        metadata={"order_id": order_id, "product": original_product},
    )


def send_replenishment_reminder(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    product_title: str,
    product_url: str,
    product_image_url: str,
    price: float,
    currency: str = "KSh",
    days_since_purchase: int = 14,
) -> bool:
    """
    Sent 14–30 days after purchase for consumable products.
    The "Subscribe & Save" seed.
    """
    logger.info(f"[PostPurchase] Sending replenishment reminder: user={user_id}")

    content = f"""
    <div style="text-align:center;margin:28px 0;">
      <img src="{product_image_url}" alt="{product_title}" style="max-width:200px;border-radius:12px;margin-bottom:16px;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#1e293b;">{product_title}</p>
      <p style="margin:8px 0 0;font-size:22px;font-weight:900;color:#f97316;">{currency} {price:,.0f}</p>
    </div>

    <div style="background:#f0fdf4;border-radius:10px;padding:20px 24px;margin:24px 0;border:1px solid #bbf7d0;text-align:center;">
      <p style="margin:0 0 16px;font-size:15px;color:#15803d;font-weight:600;">
        It's been {days_since_purchase} days since your last order. Running low?
      </p>
      <a href="{product_url}" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Reorder Now →
      </a>
    </div>
    """

    html_body = _base_template(
        title=f"Running low, {buyer_name}?",
        subtitle=f"You bought {product_title} about {days_since_purchase} days ago. Time to restock?",
        content=content,
    )

    return _send_email(
        to_email=buyer_email,
        subject=f"Time to restock? Reorder {product_title} | Suqafuran",
        html_body=html_body,
        email_type="replenishment_reminder",
        user_id=user_id,
        metadata={"product": product_title, "days": days_since_purchase},
    )


# ═════════════════════════════════════════════════════════════
#  STEP 4 — WIN THEM BACK  (triggered by Celery beat)
# ═════════════════════════════════════════════════════════════

def send_win_back_miss_you(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    last_purchase_product: Optional[str] = None,
    days_inactive: int = 45,
    browse_url: str = "",
) -> bool:
    """Day 45 lapse: soft "we miss you" re-engagement."""
    logger.info(f"[PostPurchase] Win-back (day {days_inactive}): user={user_id}")

    browse_url = browse_url or settings.FRONTEND_URL

    product_line = f"<p>Last time you bought <strong>{last_purchase_product}</strong>. Ready for your next find?</p>" if last_purchase_product else ""

    content = f"""
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:64px;">👋</span>
    </div>

    <p>It's been a while since we've seen you on Suqafuran, and we wanted to check in.</p>
    {product_line}
    <p>There are thousands of new listings waiting for you — from verified sellers across Kenya and Somalia.</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="{browse_url}" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        See What's New →
      </a>
    </div>
    """

    html_body = _base_template(
        title=f"We miss you, {buyer_name} 👋",
        subtitle="It's been a while. Come see what's new on Suqafuran.",
        content=content,
    )

    return _send_email(
        to_email=buyer_email,
        subject=f"We miss you, {buyer_name} 👋 — Come back to Suqafuran",
        html_body=html_body,
        email_type="win_back_miss_you",
        user_id=user_id,
        metadata={"days_inactive": days_inactive},
    )


def send_win_back_secret_offer(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    coupon_code: str,
    discount_percent: int,
    expiry_hours: int = 48,
    shop_url: str = "",
) -> bool:
    """Day 90 lapse: secret coupon to win them back."""
    logger.info(f"[PostPurchase] Win-back secret offer: user={user_id}, coupon={coupon_code}")

    shop_url = shop_url or settings.FRONTEND_URL
    expiry_dt = datetime.utcnow() + timedelta(hours=expiry_hours)
    expiry_str = expiry_dt.strftime("%A, %d %B %Y at %H:%M UTC")

    content = f"""
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:64px;">🎁</span>
      <p style="margin:12px 0 4px;font-size:14px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Exclusive offer — just for you</p>
      <p style="margin:0;font-size:36px;font-weight:900;color:#1e293b;">{discount_percent}% OFF</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Your next order on Suqafuran</p>
    </div>

    <div style="background:#f5f3ff;border-radius:12px;padding:28px;margin:28px 0;border:2px dashed #8b5cf6;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:#7c3aed;font-weight:700;">YOUR SECRET CODE</p>
      <p style="margin:0;font-size:32px;font-weight:900;color:#5b21b6;letter-spacing:6px;font-family:monospace;">{coupon_code}</p>
      <p style="margin:12px 0 0;font-size:12px;color:#6d28d9;">Expires: {expiry_str}</p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="{shop_url}?coupon={coupon_code}" style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Use My {discount_percent}% OFF →
      </a>
    </div>

    <p style="font-size:12px;color:#94a3b8;text-align:center;">
      This offer is exclusively for you and cannot be shared. Valid for {expiry_hours} hours only.
    </p>
    """

    html_body = _base_template(
        title=f"A secret offer just for you, {buyer_name} 🎁",
        subtitle=f"We've reserved an exclusive {discount_percent}% discount — but it expires in {expiry_hours} hours.",
        content=content,
    )

    return _send_email(
        to_email=buyer_email,
        subject=f"🎁 Your secret {discount_percent}% OFF — {expiry_hours}h only | Suqafuran",
        html_body=html_body,
        email_type="win_back_secret_offer",
        user_id=user_id,
        metadata={"coupon": coupon_code, "discount": discount_percent, "expiry_hours": expiry_hours},
    )


def send_anniversary_coupon(
    *,
    user_id: int,
    buyer_name: str,
    buyer_email: str,
    years: int,
    coupon_code: str,
    discount_percent: int,
    shop_url: str = "",
) -> bool:
    """Sent on the anniversary of the user's first purchase."""
    logger.info(f"[PostPurchase] Anniversary coupon: user={user_id}, years={years}")

    shop_url = shop_url or settings.FRONTEND_URL
    year_label = "1 year" if years == 1 else f"{years} years"

    content = f"""
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:64px;">🎂</span>
      <p style="margin:12px 0 0;font-size:20px;font-weight:800;color:#1e293b;">{year_label} with Suqafuran!</p>
    </div>

    <p>To celebrate {year_label} of shopping together, here's a little gift from all of us:</p>

    <div style="background:#fef2f2;border-radius:12px;padding:28px;margin:28px 0;border:2px dashed #fca5a5;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:#dc2626;font-weight:700;">ANNIVERSARY GIFT</p>
      <p style="margin:0;font-size:32px;font-weight:900;color:#b91c1c;letter-spacing:6px;font-family:monospace;">{coupon_code}</p>
      <p style="margin:12px 0 0;font-size:15px;color:#dc2626;font-weight:700;">{discount_percent}% off your next order</p>
      <p style="margin:4px 0 0;font-size:12px;color:#ef4444;">Valid for 7 days</p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="{shop_url}?coupon={coupon_code}" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        Claim My Gift →
      </a>
    </div>
    """

    html_body = _base_template(
        title=f"Happy {year_label} anniversary, {buyer_name}! 🎂",
        subtitle=f"You've been part of the Suqafuran family for {year_label}. Thank you!",
        content=content,
    )

    return _send_email(
        to_email=buyer_email,
        subject=f"🎂 Happy {year_label} on Suqafuran, {buyer_name}! Here's your gift",
        html_body=html_body,
        email_type="anniversary_coupon",
        user_id=user_id,
        metadata={"years": years, "coupon": coupon_code, "discount": discount_percent},
    )


# ═════════════════════════════════════════════════════════════
#  Singleton export
# ═════════════════════════════════════════════════════════════

post_purchase_service = type("PostPurchaseService", (), {
    "send_order_confirmation": staticmethod(send_order_confirmation),
    "send_order_dispatched": staticmethod(send_order_dispatched),
    "send_order_delivered": staticmethod(send_order_delivered),
    "send_seller_new_order_alert": staticmethod(send_seller_new_order_alert),
    "send_cross_sell_email": staticmethod(send_cross_sell_email),
    "send_replenishment_reminder": staticmethod(send_replenishment_reminder),
    "send_win_back_miss_you": staticmethod(send_win_back_miss_you),
    "send_win_back_secret_offer": staticmethod(send_win_back_secret_offer),
    "send_anniversary_coupon": staticmethod(send_anniversary_coupon),
})()
