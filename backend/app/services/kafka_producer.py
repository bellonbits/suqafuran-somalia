"""
Kafka Producer Wrapper - Event Publishing Service

Handles publishing domain events to Kafka with standardized envelope.
Uses aiokafka for async/await support in FastAPI endpoints.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from aiokafka import AIOKafkaProducer
from app.core.config import settings

logger = logging.getLogger("kafka_producer")


class KafkaEventProducer:
    """Publishes domain events to Kafka with standard envelope."""

    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self.is_connected = False

    async def start(self):
        """Initialize Kafka producer connection."""
        if not settings.KAFKA_BOOTSTRAP_SERVERS:
            logger.warning("Kafka not configured - events will not be published")
            return

        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            )
            await self.producer.start()
            self.is_connected = True
            logger.info(f"Kafka Producer connected to {settings.KAFKA_BOOTSTRAP_SERVERS}")
        except Exception as e:
            logger.error(f"Failed to connect Kafka Producer: {e}")
            self.is_connected = False

    async def stop(self):
        """Close Kafka producer connection."""
        if self.producer:
            await self.producer.stop()
            self.is_connected = False
            logger.info("Kafka Producer stopped")

    async def publish_event(
        self,
        topic: str,
        event_type: str,
        payload: Dict[str, Any],
        partition_key: Optional[str] = None,
        user_id: Optional[str] = None,
        source: str = "api",
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Publish an event to Kafka with standard envelope.

        Args:
            topic: Kafka topic (e.g., "suqafuran.auth.events")
            event_type: Event type (e.g., "auth.signup.success")
            payload: Event-specific data
            partition_key: Used for partition assignment (user_id, order_id, etc.)
            user_id: User associated with event
            source: Origin of event (api, scheduled, internal)
            correlation_id: Trace ID for correlation across services
            metadata: Additional metadata (ip, device, etc.)

        Returns:
            True if published successfully, False if Kafka unavailable
        """
        if not self.is_connected or not self.producer:
            logger.error(f"❌ Kafka producer not available! is_connected={self.is_connected}, producer={self.producer is not None}. Skipping event: {event_type}")
            return False

        try:
            # Build standard event envelope
            event = {
                "event_id": str(uuid.uuid4()),
                "event_type": event_type,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "user_id": user_id,
                "source": source,
                "correlation_id": correlation_id or str(uuid.uuid4()),
                "payload": payload,
                "metadata": metadata or {},
            }

            # Use partition_key for ordering guarantee (same entity stays on same partition)
            key = (partition_key or user_id or "").encode('utf-8') if partition_key or user_id else None

            logger.info(f"📤 Publishing {event_type} to {topic}...")

            # Publish asynchronously
            await self.producer.send_and_wait(
                topic,
                value=event,
                key=key,
            )

            logger.info(f"✅ Published {event_type} to {topic} (id: {event['event_id']})")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to publish event {event_type}: {e}", exc_info=True)
            return False


# Global producer instance
kafka_producer = KafkaEventProducer()


# Convenience functions for each domain
async def publish_auth_event(
    event_type: str,
    payload: Dict[str, Any],
    user_id: Optional[str] = None,
    phone_or_email: Optional[str] = None,
    **kwargs
):
    """Publish authentication event."""
    await kafka_producer.publish_event(
        topic="suqafuran.auth.events",
        event_type=f"auth.{event_type}",
        payload=payload,
        partition_key=phone_or_email or user_id,
        user_id=user_id,
        **kwargs
    )


async def publish_catalog_event(
    event_type: str,
    payload: Dict[str, Any],
    seller_id: str,
    **kwargs
):
    """Publish catalog event."""
    await kafka_producer.publish_event(
        topic="suqafuran.catalog.events",
        event_type=f"catalog.{event_type}",
        payload=payload,
        partition_key=seller_id,
        user_id=seller_id,
        **kwargs
    )


async def publish_order_event(
    event_type: str,
    payload: Dict[str, Any],
    order_id: str,
    user_id: Optional[str] = None,
    **kwargs
):
    """Publish order event."""
    await kafka_producer.publish_event(
        topic="suqafuran.orders.events",
        event_type=f"orders.{event_type}",
        payload=payload,
        partition_key=order_id,
        user_id=user_id,
        **kwargs
    )


async def publish_payment_event(
    event_type: str,
    payload: Dict[str, Any],
    order_id: str,
    user_id: Optional[str] = None,
    **kwargs
):
    """Publish payment event."""
    await kafka_producer.publish_event(
        topic="suqafuran.payments.events",
        event_type=f"payments.{event_type}",
        payload=payload,
        partition_key=order_id,
        user_id=user_id,
        **kwargs
    )


async def publish_rider_event(
    event_type: str,
    payload: Dict[str, Any],
    rider_id: str,
    **kwargs
):
    """Publish rider/delivery event."""
    await kafka_producer.publish_event(
        topic="suqafuran.riders.events",
        event_type=f"riders.{event_type}",
        payload=payload,
        partition_key=rider_id,
        user_id=rider_id,
        **kwargs
    )


async def publish_notification_dispatch(
    user_id: str,
    event_type: str,
    channels: list,
    template: str,
    data: Dict[str, Any],
    **kwargs
):
    """
    Publish a notification dispatch command.

    This is what the notification consumer listens for.
    """
    payload = {
        "original_event_type": event_type,
        "channels": channels,
        "template": template,
        "template_data": data,
    }

    await kafka_producer.publish_event(
        topic="suqafuran.notifications.dispatch",
        event_type="notifications.dispatch.requested",
        payload=payload,
        partition_key=user_id,
        user_id=user_id,
        **kwargs
    )


# ─── Monitoring & Analytics Topics ──────────────────────────────────────────

async def publish_signup_event(
    user_id: int,
    email: str,
    phone: Optional[str] = None,
    promo_code: Optional[str] = None,
    **kwargs
):
    """Publish user signup event to monitoring topic."""
    await kafka_producer.publish_event(
        topic=settings.KAFKA_TOPIC_SIGNUP,
        event_type="user.signup.completed",
        payload={
            "user_id": user_id,
            "email": email,
            "phone": phone,
            "promo_code": promo_code,
        },
        partition_key=str(user_id),
        user_id=str(user_id),
        **kwargs
    )


async def publish_signin_event(
    user_id: int,
    email: str,
    auth_method: str = "email_otp",
    full_name: Optional[str] = None,
    **kwargs
):
    """Publish user signin event to monitoring topic."""
    await kafka_producer.publish_event(
        topic=settings.KAFKA_TOPIC_SIGNIN,
        event_type="user.signin.completed",
        payload={
            "user_id": user_id,
            "email": email,
            "auth_method": auth_method,
            "full_name": full_name,
        },
        partition_key=str(user_id),
        user_id=str(user_id),
        **kwargs
    )


async def publish_tracking_event(
    user_id: Optional[int] = None,
    event_type: str = "page_view",
    page: Optional[str] = None,
    action: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    **kwargs
):
    """Publish user tracking/analytics event."""
    await kafka_producer.publish_event(
        topic=settings.KAFKA_TOPIC_TRACKING,
        event_type=f"tracking.{event_type}",
        payload={
            "page": page,
            "action": action,
            "metadata": metadata or {},
        },
        partition_key=str(user_id) if user_id else "anonymous",
        user_id=str(user_id) if user_id else None,
        **kwargs
    )


async def publish_checkout_event(
    order_id: str,
    user_id: int,
    amount: float,
    currency: str = "KES",
    status: str = "initiated",
    **kwargs
):
    """Publish checkout/purchase event."""
    await kafka_producer.publish_event(
        topic=settings.KAFKA_TOPIC_CHECKOUT,
        event_type="checkout.event",
        payload={
            "order_id": order_id,
            "user_id": user_id,
            "amount": amount,
            "currency": currency,
            "status": status,
        },
        partition_key=str(order_id),
        user_id=str(user_id),
        **kwargs
    )


async def publish_upload_failure_event(
    user_id: int,
    endpoint: str,
    filename: str,
    error: str,
    file_type: str = "image",
    **kwargs
):
    """Publish file upload failure event for debugging."""
    await kafka_producer.publish_event(
        topic=settings.KAFKA_TOPIC_UPLOAD_FAILURES,
        event_type="upload.failed",
        payload={
            "user_id": user_id,
            "endpoint": endpoint,
            "filename": filename,
            "error": error,
            "file_type": file_type,
        },
        partition_key=str(user_id),
        user_id=str(user_id),
        **kwargs
    )
