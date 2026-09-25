"""
Kafka Email Notifier - Sends event summaries to admin email
Consumes from monitoring topics and sends formatted emails
"""

import json
import logging
import threading
from typing import Optional, Dict, Any
from datetime import datetime
from confluent_kafka import Consumer, KafkaError
from app.core.config import settings
from app.services.email_service import email_service

logger = logging.getLogger("kafka_email_notifier")

ADMIN_EMAIL = "petergatitu61@gmail.com"


def _icon(paths: str, color: str, size: int = 22) -> str:
    """Inline SVG matching the actual lucide-react icons used in the app
    (same path data, pulled from the lucide-react package) -- email clients
    can't run React, so this is the real-icon equivalent for HTML email:
    genuine icon artwork instead of a Unicode emoji glyph."""
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
        f'stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
        f'style="vertical-align: middle; margin-right: 8px;">{paths}</svg>'
    )


ICON_USER_PLUS = _icon(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>'
    '<circle cx="9" cy="7" r="4"/>'
    '<line x1="19" x2="19" y1="8" y2="14"/>'
    '<line x1="22" x2="16" y1="11" y2="11"/>',
    "#4CAF50",
)
ICON_LOCK = _icon(
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>'
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "#2196F3",
)
ICON_PEN_LINE = _icon(
    '<path d="M13 21h8"/>'
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    "#FF9800",
)
ICON_SHOPPING_CART = _icon(
    '<circle cx="8" cy="21" r="1"/>'
    '<circle cx="19" cy="21" r="1"/>'
    '<path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    "#4CAF50",
)
ICON_TRIANGLE_ALERT = _icon(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>'
    '<path d="M12 9v4"/>'
    '<path d="M12 17h.01"/>',
    "#F44336",
)
ICON_ACTIVITY = _icon(
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    "#607D8B",
)


class KafkaEmailNotifier:
    """Sends Kafka events to admin email."""

    def __init__(self):
        self.consumer: Optional[Consumer] = None
        self.thread: Optional[threading.Thread] = None
        self.running = False
        self.monitoring_topics = [
            settings.KAFKA_TOPIC_SIGNUP,
            settings.KAFKA_TOPIC_SIGNIN,
            settings.KAFKA_TOPIC_TRACKING,
            settings.KAFKA_TOPIC_CHECKOUT,
            settings.KAFKA_TOPIC_UPLOAD_FAILURES,
        ]

    def start(self):
        """Start the email notifier in a background thread."""
        if self.running:
            logger.warning("Email notifier already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._consume_loop, daemon=True)
        self.thread.start()
        logger.info(f"✉️  Kafka Email Notifier started → {ADMIN_EMAIL}")

    def stop(self):
        """Stop the email notifier."""
        self.running = False
        if self.consumer:
            self.consumer.close()
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("✉️  Kafka Email Notifier stopped")

    def _consume_loop(self):
        """Main consumer loop - runs in background thread."""
        try:
            config = {
                'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
                'group.id': 'suqafuran-email-notifier',
                'auto.offset.reset': 'latest',
                'enable.auto.commit': True,
                'session.timeout.ms': 6000,
            }

            self.consumer = Consumer(config)
            self.consumer.subscribe(self.monitoring_topics)
            logger.info(f"📧 Subscribed to monitoring topics for email notifications")

            while self.running:
                msg = self.consumer.poll(timeout=1.0)

                if msg is None:
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        logger.error(f"Kafka error: {msg.error()}")
                        continue

                # Send email for this event
                self._send_event_email(msg)

        except Exception as e:
            logger.error(f"Email notifier error: {e}", exc_info=True)
        finally:
            if self.consumer:
                self.consumer.close()

    def _send_event_email(self, msg):
        """Send an email for a Kafka event."""
        try:
            topic = msg.topic()
            partition = msg.partition()
            offset = msg.offset()

            # Parse event payload
            try:
                event = json.loads(msg.value().decode('utf-8'))
            except:
                return

            event_type = event.get('event_type', 'unknown')
            user_id = event.get('user_id')
            timestamp = event.get('timestamp')
            payload = event.get('payload', {})

            # Format email based on event type
            subject, body_html = self._format_email(topic, event_type, payload, user_id, timestamp)

            # Send email
            email_service.send_email(
                to=ADMIN_EMAIL,
                subject=subject,
                html_content=body_html,
            )

            logger.info(f"📧 Email sent for {event_type} (user_id: {user_id})")

        except Exception as e:
            logger.error(f"Failed to send email for event: {e}")

    def _format_email(self, topic: str, event_type: str, payload: Dict[str, Any],
                      user_id: Optional[int], timestamp: str) -> tuple:
        """Format email subject and body for different event types."""

        ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S') if timestamp else 'N/A'

        if 'signup' in event_type:
            subject = f"New User Signup - {payload.get('email', 'Unknown')}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #4CAF50;">{ICON_USER_PLUS}New User Signup</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>User ID</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{user_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Email</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('email', 'N/A')}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Phone</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('phone', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Promo Code</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('promo_code', 'None')}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Timestamp</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{ts}</td>
                    </tr>
                </table>
            </body>
            </html>
            """

        elif 'signin' in event_type:
            display_name = payload.get('full_name') or payload.get('email', 'Unknown')
            subject = f"User Login - {display_name}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #2196F3;">{ICON_LOCK}User Login</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Name</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('full_name') or 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>User ID</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{user_id}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Email</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('email', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Auth Method</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('auth_method', 'N/A').upper()}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Timestamp</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{ts}</td>
                    </tr>
                </table>
            </body>
            </html>
            """

        elif 'listing_created' in event_type:
            # publish_tracking_event nests the real fields under payload["metadata"]
            # (page/action/metadata is that function's generic shape for every
            # tracking event) -- reading them at the top level of payload, like
            # every other branch here does, silently returned the fallback for
            # all of them.
            meta = payload.get('metadata', {}) or {}
            subject = f"New Listing Created - {meta.get('title', 'Unknown')}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #FF9800;">{ICON_PEN_LINE}New Listing Created</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Listing ID</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{meta.get('listing_id', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Title</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{meta.get('title', 'N/A')}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Price</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">KES {meta.get('price', 0):,.2f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Category</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{meta.get('category', 'N/A')}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Seller</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{meta.get('seller_name', 'N/A')} (ID {user_id})</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Timestamp</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{ts}</td>
                    </tr>
                </table>
            </body>
            </html>
            """

        elif 'checkout' in event_type:
            subject = f"Checkout Event - KES {payload.get('amount', 0):,.2f}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #4CAF50;">{ICON_SHOPPING_CART}Checkout Event</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Order ID</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('order_id', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Amount</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">KES {payload.get('amount', 0):,.2f}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Status</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('status', 'N/A').upper()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Customer ID</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{user_id}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Timestamp</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{ts}</td>
                    </tr>
                </table>
            </body>
            </html>
            """

        elif 'upload' in event_type and 'failed' in event_type:
            subject = f"Upload Failed - {payload.get('filename', 'Unknown')}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #F44336;">{ICON_TRIANGLE_ALERT}Upload Failed</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>User ID</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{user_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Filename</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('filename', 'N/A')}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>File Type</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payload.get('file_type', 'N/A').upper()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Endpoint</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;"><code>{payload.get('endpoint', 'N/A')}</code></td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Error</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;"><code style="color: red;">{payload.get('error', 'N/A')}</code></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><b>Timestamp</b></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{ts}</td>
                    </tr>
                </table>
            </body>
            </html>
            """

        else:
            subject = f"Marketplace Event - {event_type}"
            body_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2>{ICON_ACTIVITY}Marketplace Event</h2>
                <p><b>Event Type:</b> {event_type}</p>
                <p><b>User ID:</b> {user_id}</p>
                <p><b>Timestamp:</b> {ts}</p>
                <h3>Payload:</h3>
                <pre style="background-color: #f2f2f2; padding: 10px; border-radius: 4px;">
{json.dumps(payload, indent=2)}
                </pre>
            </body>
            </html>
            """

        return subject, body_html


# Global email notifier instance
email_notifier = KafkaEmailNotifier()
