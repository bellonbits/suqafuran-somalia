"""
Notification Consumer - Kafka Event Processing

Reads from suqafuran.notifications.dispatch topic and triggers Celery tasks
for external notification services (Resend, Africa's Talking, Firebase, M-Pesa).

Architecture:
  Kafka Topic → Consumer Group → Notification Mapping → Celery Tasks → External Services
"""

import json
import logging
from typing import Any, Dict
from aiokafka import AIOKafkaConsumer
from app.core.config import settings
from app.tasks.notification_tasks import (
    send_email_task,
    send_sms_task,
    send_push_notification_task,
)
from app.services.notification_config import NOTIFICATION_MAPPING

logger = logging.getLogger("notification_consumer")


class NotificationConsumer:
    """Processes notification dispatch events and triggers Celery tasks."""

    def __init__(self):
        self.consumer = None
        self.is_running = False

    async def start(self):
        """Initialize notification consumer connection."""
        if not settings.KAFKA_BOOTSTRAP_SERVERS:
            logger.warning("Kafka not configured - notification consumer disabled")
            return

        try:
            self.consumer = AIOKafkaConsumer(
                "suqafuran.notifications.dispatch",
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id="notifications-service",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                session_timeout_ms=30000,
            )
            await self.consumer.start()
            self.is_running = True
            logger.info("Notification Consumer started, listening to suqafuran.notifications.dispatch")
        except Exception as e:
            logger.error(f"Failed to start Notification Consumer: {e}")
            self.is_running = False

    async def stop(self):
        """Close consumer connection."""
        if self.consumer:
            await self.consumer.stop()
            self.is_running = False
            logger.info("Notification Consumer stopped")

    async def process_events(self):
        """
        Main event loop - continuously process dispatch events.

        Call this in a background task runner.
        """
        if not self.is_running:
            logger.error("Consumer not started")
            return

        try:
            async for message in self.consumer:
                try:
                    event = message.value
                    await self._handle_notification_event(event)
                except Exception as e:
                    logger.error(f"Error processing notification event: {e}", exc_info=True)

        except Exception as e:
            logger.error(f"Consumer error: {e}", exc_info=True)
            self.is_running = False

    async def _handle_notification_event(self, event: Dict[str, Any]) -> None:
        """
        Route notification event to appropriate Celery tasks.

        Args:
            event: Kafka event with standard envelope
                {
                    "event_id": uuid,
                    "event_type": "notifications.dispatch.requested",
                    "timestamp": "2026-07-15T...",
                    "user_id": "user_123",
                    "correlation_id": uuid,
                    "payload": {
                        "original_event_type": "auth.signup.success",
                        "channels": ["email", "sms"],
                        "template": "welcome",
                        "template_data": {...}
                    }
                }
        """
        try:
            payload = event.get("payload", {})
            user_id = event.get("user_id")
            event_id = event.get("event_id")
            correlation_id = event.get("correlation_id")
            timestamp = event.get("timestamp")

            original_event_type = payload.get("original_event_type")
            channels = payload.get("channels", [])
            template = payload.get("template")
            template_data = payload.get("template_data", {})

            logger.info(
                f"Processing notification dispatch",
                extra={
                    "event_id": event_id,
                    "original_event_type": original_event_type,
                    "user_id": user_id,
                    "channels": channels,
                }
            )

            # Get notification config for this event type
            config = NOTIFICATION_MAPPING.get(original_event_type)
            if not config:
                logger.warning(f"No notification config for event type: {original_event_type}")
                return

            # Trigger tasks for each enabled channel
            if "email" in channels:
                await self._send_email(
                    user_id=user_id,
                    template=template,
                    template_data=template_data,
                    correlation_id=correlation_id,
                )

            if "sms" in channels:
                await self._send_sms(
                    user_id=user_id,
                    template=template,
                    template_data=template_data,
                    correlation_id=correlation_id,
                )

            if "push" in channels:
                await self._send_push(
                    user_id=user_id,
                    template=template,
                    template_data=template_data,
                    correlation_id=correlation_id,
                )

            logger.info(
                f"Notification dispatch completed",
                extra={"event_id": event_id, "user_id": user_id}
            )

        except Exception as e:
            logger.error(f"Failed to handle notification event: {e}", exc_info=True)

    async def _send_email(
        self,
        user_id: str,
        template: str,
        template_data: Dict[str, Any],
        correlation_id: str,
    ) -> None:
        """Trigger email task via Celery (Resend)."""
        try:
            # Queue the Celery task - it will execute asynchronously
            send_email_task.delay(
                user_id=user_id,
                template=template,
                template_data=template_data,
                correlation_id=correlation_id,
            )
            logger.info(f"Queued email task for user {user_id}, template {template}")
        except Exception as e:
            logger.error(f"Failed to queue email task: {e}")

    async def _send_sms(
        self,
        user_id: str,
        template: str,
        template_data: Dict[str, Any],
        correlation_id: str,
    ) -> None:
        """Trigger SMS task via Celery (Africa's Talking)."""
        try:
            # Queue the Celery task - it will execute asynchronously
            send_sms_task.delay(
                user_id=user_id,
                template=template,
                template_data=template_data,
                correlation_id=correlation_id,
            )
            logger.info(f"Queued SMS task for user {user_id}, template {template}")
        except Exception as e:
            logger.error(f"Failed to queue SMS task: {e}")

    async def _send_push(
        self,
        user_id: str,
        template: str,
        template_data: Dict[str, Any],
        correlation_id: str,
    ) -> None:
        """Trigger push notification task via Celery (Firebase)."""
        try:
            # Queue the Celery task - it will execute asynchronously
            send_push_notification_task.delay(
                user_id=user_id,
                template=template,
                template_data=template_data,
                correlation_id=correlation_id,
            )
            logger.info(f"Queued push notification task for user {user_id}, template {template}")
        except Exception as e:
            logger.error(f"Failed to queue push notification task: {e}")


# Global consumer instance
notification_consumer = NotificationConsumer()


def start_notification_consumer():
    """
    Hook to start the notification consumer in app startup.

    Call this in FastAPI on_event("startup").
    Ensure it runs in a background thread/task.

    Example:
        from app.services.notification_consumer import start_notification_consumer

        @app.on_event("startup")
        async def startup():
            asyncio.create_task(notification_consumer.process_events())
    """
    pass
