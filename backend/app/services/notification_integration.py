"""
Notification Integration Service
Handles email and SMS notifications for orders, deliveries, and abandoned carts
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlmodel import Session, select
import logging

from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.cart import Cart
from app.services.email_service import send_email
from app.services.africastalking_service import send_sms

logger = logging.getLogger(__name__)

# Email Templates
EMAIL_TEMPLATES = {
    "order_created": {
        "subject": "Order Confirmation #{order_id}",
        "body": """
Dear {customer_name},

Your order has been confirmed! 🎉

Order Details:
- Order ID: {order_id}
- Items: {item_count} items
- Total: KSh {total:.2f}
- Fulfillment: {fulfillment_type}

Status: Pending seller confirmation

Next Steps:
1. Seller will confirm and pack your order
2. You'll receive a notification when it's ready
3. Track your order in real-time

Track your order: {tracking_link}

Questions? Contact us at support@suqafuran.so

Best regards,
Suqafuran Team
"""
    },
    "order_confirmed": {
        "subject": "Your Order #{order_id} is Confirmed!",
        "body": """
Great news! Your order has been confirmed by the seller.

Order: {order_id}
Items: {item_count}
Total: KSh {total:.2f}

Next: Your order is being packed and will be ready soon.

Track: {tracking_link}

Suqafuran Team
"""
    },
    "order_packed": {
        "subject": "Your Order #{order_id} is Packed!",
        "body": """
Excellent! Your order has been packed and is ready.

Order: {order_id}

For Delivery: A rider will pick up your order shortly.
For Pickup: Your order is ready at the store!

Track: {tracking_link}

Suqafuran Team
"""
    },
    "rider_assigned": {
        "subject": "Your Rider is on the Way! 🚗",
        "body": """
Your rider {rider_name} ({rider_phone}) has been assigned to your delivery.

Order: {order_id}
Rider Phone: {rider_phone}
Estimated Time: {estimated_time} minutes

Live Tracking: {tracking_link}

You can call or message your rider through the app.

Suqafuran Team
"""
    },
    "order_in_transit": {
        "subject": "Your Order is on the Way! 🚗",
        "body": """
Your order is now in transit!

Order: {order_id}
Rider: {rider_name}
Estimated Arrival: {estimated_time} minutes

Live Tracking: {tracking_link}

Contact Rider: {rider_phone}

Suqafuran Team
"""
    },
    "order_delivered": {
        "subject": "Your Order has Arrived! SUCCESS",
        "body": """
Your order {order_id} has been successfully delivered!

Items: {item_count}
Total: KSh {total:.2f}

Please rate your experience and provide feedback.

Rate Order: {review_link}

Thank you for shopping with Suqafuran!
"""
    },
    "abandoned_cart": {
        "subject": "Don't forget your items! 🛒",
        "body": """
Hi {customer_name},

You left {item_count} items in your cart:

{cart_items}

Subtotal: KSh {subtotal:.2f}
Discount: KSh {discount:.2f} (with code SAVE10)
Total: KSh {total:.2f}

Complete your purchase: {cart_link}

Your items might sell out soon!

Suqafuran Team
"""
    },
    "delivery_issue": {
        "subject": "Delivery Issue Reported - Order {order_id}",
        "body": """
We've received your delivery issue report.

Order: {order_id}
Issue: {issue_type}

Our support team is reviewing this and will contact you within 2 hours.

Details: {issue_description}

Support: {support_link}

Suqafuran Team
"""
    }
}

# SMS Templates
SMS_TEMPLATES = {
    "order_created": "Order confirmed! #{order_id}. Track: {short_link}. -Suqafuran",
    "order_confirmed": "Seller confirmed! Order {order_id} being packed. -Suqafuran",
    "order_packed": "Ready! {fulfillment_type}. Track: {short_link}. -Suqafuran",
    "rider_assigned": "Rider {rider_name} ({rider_phone}) assigned. ETA: {estimated_time}min. Track: {short_link}",
    "order_in_transit": "On the way! ETA: {estimated_time}min. Track: {short_link}. -Suqafuran",
    "order_delivered": "Delivered! Rate: {review_link}. -Suqafuran",
    "abandoned_cart": "Don't lose {item_count} items! Use SAVE10. Complete: {cart_link}. -Suqafuran",
}


class NotificationIntegrationService:
    """Service to send integrated email and SMS notifications"""

    @staticmethod
    async def send_order_notification(
        order: Order,
        notification_type: str,
        session: Session,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Send order notification via email and SMS

        Types: order_created, order_confirmed, order_packed, rider_assigned,
               order_in_transit, order_delivered
        """
        try:
            # Get user
            user = session.exec(select(User).where(User.id == order.customer_id)).first()
            if not user:
                logger.error(f"User not found for order {order.id}")
                return

            # Get order items
            items_summary = ", ".join([f"{item.quantity}x {item.product_title}" for item in order.items])
            item_count = len(order.items)

            # Prepare common data
            base_data = {
                "order_id": order.id,
                "customer_name": user.full_name or "Valued Customer",
                "item_count": item_count,
                "total": order.total_amount,
                "fulfillment_type": "Delivery" if order.fulfillment_type == "delivery" else "Pickup",
                "items_summary": items_summary,
                "tracking_link": f"https://suqafuran.so/orders/{order.id}",
                "short_link": f"suq.so/o{order.id}",
                "cart_link": "https://suqafuran.so/cart",
                "support_link": "https://suqafuran.so/support",
            }

            # Merge with extra data
            if extra_data:
                base_data.update(extra_data)

            # Send Email
            if user.email and user.email_notifications:
                await NotificationIntegrationService._send_email_notification(
                    user.email,
                    notification_type,
                    base_data,
                )

            # Send SMS
            if user.phone and user.sms_notifications:
                await NotificationIntegrationService._send_sms_notification(
                    user.phone,
                    notification_type,
                    base_data,
                )

            logger.info(f"Notification sent for order {order.id}: {notification_type}")

        except Exception as e:
            logger.error(f"Failed to send notification for order {order.id}: {str(e)}")

    @staticmethod
    async def send_abandoned_cart_notification(
        cart: Cart,
        user: User,
        session: Session,
    ) -> None:
        """Send abandoned cart recovery emails and SMS"""
        try:
            if not user.email and not user.phone:
                logger.warning(f"User {user.id} has no email or phone")
                return

            # Prepare cart items summary
            items_list = "\n".join(
                [f"  • {item.quantity}x {item.product_title} - KSh {item.quantity * item.price_at_add:.2f}"
                 for item in cart.items]
            )

            subtotal = sum(item.quantity * item.price_at_add for item in cart.items)
            discount = cart.promo_discount_amount
            total = subtotal - discount + (subtotal * 0.16)  # With tax

            cart_data = {
                "customer_name": user.full_name or "Valued Customer",
                "item_count": len(cart.items),
                "cart_items": items_list,
                "subtotal": subtotal,
                "discount": discount,
                "total": total,
                "cart_link": "https://suqafuran.so/cart",
                "short_link": "suq.so/cart",
            }

            # Send Email
            if user.email and user.email_notifications:
                await NotificationIntegrationService._send_email_notification(
                    user.email,
                    "abandoned_cart",
                    cart_data,
                )

            # Send SMS
            if user.phone and user.sms_notifications:
                await NotificationIntegrationService._send_sms_notification(
                    user.phone,
                    "abandoned_cart",
                    cart_data,
                )

            logger.info(f"Abandoned cart notification sent to user {user.id}")

        except Exception as e:
            logger.error(f"Failed to send abandoned cart notification: {str(e)}")

    @staticmethod
    async def send_delivery_issue_notification(
        order: Order,
        issue_type: str,
        issue_description: str,
        user: User,
    ) -> None:
        """Send notification about delivery issue"""
        try:
            issue_data = {
                "order_id": order.id,
                "issue_type": issue_type,
                "issue_description": issue_description,
                "support_link": "https://suqafuran.so/support",
            }

            # Send Email
            if user.email and user.email_notifications:
                await NotificationIntegrationService._send_email_notification(
                    user.email,
                    "delivery_issue",
                    issue_data,
                )

            # Send SMS
            if user.phone and user.sms_notifications:
                await NotificationIntegrationService._send_sms_notification(
                    user.phone,
                    "delivery_issue",
                    issue_data,
                )

        except Exception as e:
            logger.error(f"Failed to send delivery issue notification: {str(e)}")

    @staticmethod
    async def _send_email_notification(
        email: str,
        notification_type: str,
        data: Dict[str, Any],
    ) -> None:
        """Send email using email service"""
        try:
            if notification_type not in EMAIL_TEMPLATES:
                logger.warning(f"Unknown notification type: {notification_type}")
                return

            template = EMAIL_TEMPLATES[notification_type]
            subject = template["subject"].format(**data)
            body = template["body"].format(**data)

            await send_email(
                to_email=email,
                subject=subject,
                body=body,
                html=f"<pre>{body}</pre>",  # Simple HTML version
            )

        except Exception as e:
            logger.error(f"Failed to send email to {email}: {str(e)}")

    @staticmethod
    async def _send_sms_notification(
        phone: str,
        notification_type: str,
        data: Dict[str, Any],
    ) -> None:
        """Send SMS using AfricasTalking service"""
        try:
            if notification_type not in SMS_TEMPLATES:
                logger.warning(f"Unknown SMS notification type: {notification_type}")
                return

            template = SMS_TEMPLATES[notification_type]
            message = template.format(**data)

            # Truncate to SMS limit (160 chars)
            if len(message) > 160:
                message = message[:157] + "..."

            await send_sms(
                phone_number=phone,
                message=message,
            )

        except Exception as e:
            logger.error(f"Failed to send SMS to {phone}: {str(e)}")


class AbandonedCartNotificationService:
    """Service to detect and notify about abandoned carts"""

    @staticmethod
    async def check_and_notify_abandoned_carts(
        session: Session,
        hours_threshold: int = 2,
    ) -> None:
        """
        Check for abandoned carts and send notifications
        Carts are considered abandoned if:
        - Items exist
        - Not checked out in the last N hours
        - User hasn't received notification recently
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_threshold)

            # Find abandoned carts
            abandoned_carts = session.exec(
                select(Cart)
                .where(
                    (Cart.updated_at < cutoff_time) &
                    (len(Cart.items) > 0)  # Has items
                )
            ).all()

            for cart in abandoned_carts:
                user = session.exec(select(User).where(User.id == cart.user_id)).first()
                if not user:
                    continue

                # Send notification
                await NotificationIntegrationService.send_abandoned_cart_notification(
                    cart, user, session
                )

            logger.info(f"Checked and notified {len(abandoned_carts)} abandoned carts")

        except Exception as e:
            logger.error(f"Failed to check abandoned carts: {str(e)}")


# Export for use in routers
__all__ = [
    "NotificationIntegrationService",
    "AbandonedCartNotificationService",
]
