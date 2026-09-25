"""
Notification background tasks for Kafka-driven notification dispatch.

Triggered by NotificationConsumer when processing notification dispatch events.
Supports: Resend (Email), Africa's Talking (SMS), Firebase (Push).
"""
from celery import shared_task
from celery.utils.log import get_task_logger
from typing import Any, Dict, Optional

logger = get_task_logger(__name__)


# ============== LEGACY OTP TASK (keep for backwards compatibility) ==============

@shared_task(
    name="app.tasks.notification_tasks.send_otp",
    bind=True,
    max_retries=2,
    queue="notifications",
)
def send_otp(self, phone: str):
    """Send OTP via Africa's Talking (async)."""
    from app.services.africastalking_service import africastalking_service
    try:
        success = africastalking_service.send_verification_code(phone)
        if not success:
            raise Exception("Africa's Talking returned failure")
        logger.info(f"OTP sent to {phone}")
        return {"success": True}
    except Exception as exc:
        logger.warning(f"OTP send failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=10)


# ============== KAFKA-DRIVEN NOTIFICATION TASKS ==============

@shared_task(bind=True, max_retries=3, queue="notifications")
def send_email_task(
    self,
    user_id: str,
    template: str,
    template_data: Dict[str, Any],
    correlation_id: str,
    recipient_email: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send email via Resend API.

    Triggered by NotificationConsumer when processing notification.dispatch.requested events.

    Args:
        user_id: User ID to send to
        template: Resend template ID
        template_data: Template variables
        correlation_id: Trace ID
        recipient_email: Optional override email
    """
    try:
        from app.core.config import settings

        # TODO: Implement Resend integration
        # from resend import Resend
        # resend = Resend(api_key=settings.RESEND_API_KEY)
        # response = resend.emails.send({...})

        logger.info(
            f"Email notification queued",
            extra={
                "user_id": user_id,
                "template": template,
                "correlation_id": correlation_id,
            }
        )
        return {"status": "success", "service": "resend"}

    except Exception as exc:
        logger.error(
            f"Failed to send email: {exc}",
            extra={"user_id": user_id, "correlation_id": correlation_id}
        )
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3, queue="notifications")
def send_sms_task(
    self,
    user_id: str,
    template: str,
    template_data: Dict[str, Any],
    correlation_id: str,
    recipient_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send SMS via Africa's Talking API.

    Triggered by NotificationConsumer when processing notification.dispatch.requested events.

    Args:
        user_id: User ID to send to
        template: Template key
        template_data: Template variables
        correlation_id: Trace ID
        recipient_phone: Optional override phone
    """
    try:
        from app.core.config import settings

        # TODO: Implement Africa's Talking integration
        # import africastalking
        # response = africastalking.SMS.send(message, [recipient_phone])

        logger.info(
            f"SMS notification queued",
            extra={
                "user_id": user_id,
                "template": template,
                "correlation_id": correlation_id,
            }
        )
        return {"status": "success", "service": "africas_talking"}

    except Exception as exc:
        logger.error(
            f"Failed to send SMS: {exc}",
            extra={"user_id": user_id, "correlation_id": correlation_id}
        )
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3, queue="notifications")
def send_push_notification_task(
    self,
    user_id: str,
    template: str,
    template_data: Dict[str, Any],
    correlation_id: str,
    title: Optional[str] = None,
    body: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send push notification via Firebase Cloud Messaging.

    Triggered by NotificationConsumer when processing notification.dispatch.requested events.

    Args:
        user_id: User ID to send to
        template: Template key
        template_data: Template variables
        correlation_id: Trace ID
        title: Optional override title
        body: Optional override body
    """
    try:
        from app.core.config import settings

        # TODO: Implement Firebase integration
        # import firebase_admin
        # from firebase_admin import messaging
        # response = messaging.send_multicast(message)

        logger.info(
            f"Push notification queued",
            extra={
                "user_id": user_id,
                "template": template,
                "correlation_id": correlation_id,
            }
        )
        return {"status": "success", "service": "firebase"}

    except Exception as exc:
        logger.error(
            f"Failed to send push notification: {exc}",
            extra={"user_id": user_id, "correlation_id": correlation_id}
        )
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
