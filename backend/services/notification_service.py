"""
Notification Service - Handles multi-channel notifications
Supports: Email (Resend), SMS (Africastalking), Push (Firebase), In-app
"""
import asyncio
import logging
from typing import List, Optional, Dict
from datetime import datetime
import json

import resend
from firebase_admin import messaging
import africastalking

from models import Notification, NotificationLog, NotificationPreference, User
from database import SessionLocal
from config import settings
from celery_app import celery_app

logger = logging.getLogger(__name__)

# Initialize services
resend.api_key = settings.RESEND_API_KEY

at_username = settings.AFRICASTALKING_USERNAME
at_api_key = settings.AFRICASTALKING_API_KEY
africastalking.initialize(at_username, at_api_key)
sms = africastalking.SMS


class NotificationService:
    """Service for sending notifications through multiple channels"""

    @staticmethod
    def _create_log(
        notification_id: str,
        channel: str,
        status: str = "pending",
        error_message: str = None,
    ) -> NotificationLog:
        """Create a notification log entry"""
        return NotificationLog(
            notification_id=notification_id,
            channel=channel,
            status=status,
            error_message=error_message,
        )

    @staticmethod
    async def send_email(
        notification: Notification,
        user: User,
        preferences: NotificationPreference,
    ) -> bool:
        """Send email notification via Resend"""
        try:
            if not preferences.email_notifications:
                return False

            # Get email template
            template_name = f"notification_{notification.type}"
            subject = notification.title
            html = _get_email_template(
                notification_type=notification.type,
                title=notification.title,
                message=notification.message,
                action_url=notification.action_url,
                action_label=notification.action_label,
            )

            # Send email
            response = resend.Emails.send(
                {
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": user.email,
                    "subject": subject,
                    "html": html,
                }
            )

            return response.get("id") is not None
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False

    @staticmethod
    async def send_sms(
        notification: Notification,
        user: User,
        preferences: NotificationPreference,
    ) -> bool:
        """Send SMS notification via Africastalking"""
        try:
            if not preferences.sms_notifications:
                return False

            # Format message (keep it short for SMS)
            message = f"{notification.title}: {notification.message[:160]}"

            # Send SMS
            response = sms.send(message, [user.phone])

            if response.get("SMSMessageData"):
                recipients = response["SMSMessageData"].get("Recipients", [])
                if recipients and recipients[0].get("statusCode") == 101:
                    return True

            return False
        except Exception as e:
            logger.error(f"Failed to send SMS: {str(e)}")
            return False

    @staticmethod
    async def send_push(
        notification: Notification,
        device_tokens: List[str],
        preferences: NotificationPreference,
    ) -> bool:
        """Send push notification via Firebase Cloud Messaging"""
        try:
            if not preferences.push_notifications or not device_tokens:
                return False

            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=notification.title,
                    body=notification.message,
                ),
                data={
                    "notification_id": notification.id,
                    "type": notification.type,
                    "action_url": notification.action_url or "",
                },
                tokens=device_tokens,
            )

            response = messaging.send_multicast(message)
            return response.success_count > 0
        except Exception as e:
            logger.error(f"Failed to send push notification: {str(e)}")
            return False

    @staticmethod
    async def send_all_channels(
        notification: Notification,
        channels: List[str],
        db,
    ) -> Dict[str, bool]:
        """Send notification through all requested channels"""
        user = db.query(User).filter(User.id == notification.user_id).first()
        preferences = (
            db.query(NotificationPreference)
            .filter(NotificationPreference.user_id == notification.user_id)
            .first()
        )

        if not user or not preferences:
            return {channel: False for channel in channels}

        results = {}

        # Send through each channel
        for channel in channels:
            try:
                if channel == "email":
                    results["email"] = await NotificationService.send_email(
                        notification, user, preferences
                    )
                elif channel == "sms":
                    results["sms"] = await NotificationService.send_sms(
                        notification, user, preferences
                    )
                elif channel == "push":
                    # Get device tokens (would be stored in DB)
                    device_tokens = _get_user_device_tokens(user.id)
                    results["push"] = await NotificationService.send_push(
                        notification, device_tokens, preferences
                    )
            except Exception as e:
                logger.error(
                    f"Error sending {channel} notification: {str(e)}"
                )
                results[channel] = False

        return results


def _get_email_template(
    notification_type: str,
    title: str,
    message: str,
    action_url: str = None,
    action_label: str = None,
) -> str:
    """Generate HTML email template"""
    action_html = ""
    if action_url and action_label:
        action_html = f"""
        <tr>
            <td style="padding: 20px 0;">
                <a href="{action_url}"
                   style="background-color: #2563eb; color: white; padding: 10px 20px;
                          border-radius: 6px; text-decoration: none; display: inline-block;">
                    {action_label}
                </a>
            </td>
        </tr>
        """

    return f"""
    <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <table style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <tr>
                    <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
                        <h1 style="margin: 0; font-size: 24px; color: #1f2937;">
                            {title}
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px 0;">
                        <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                            {message}
                        </p>
                    </td>
                </tr>
                {action_html}
                <tr>
                    <td style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                            © 2026 Suqafuran. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    """


def _get_user_device_tokens(user_id: str) -> List[str]:
    """Get push notification device tokens for user"""
    # This would be stored in a device_tokens table
    # For now, return empty list
    return []


# Celery Tasks
@celery_app.task(bind=True, max_retries=3)
def send_notification_async(
    self,
    notification_id: str,
    user_id: str,
    channels: List[str],
    preferences: Dict,
):
    """Async task to send notification through multiple channels"""
    try:
        db = SessionLocal()
        notification = (
            db.query(Notification)
            .filter(Notification.id == notification_id)
            .first()
        )

        if not notification:
            logger.error(f"Notification {notification_id} not found")
            return

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User {user_id} not found")
            return

        # Run async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        # Send through each channel
        for channel in channels:
            log = NotificationLog(
                notification_id=notification_id,
                channel=channel,
                status="pending",
            )
            db.add(log)

            try:
                if channel == "email" and preferences.get("email"):
                    success = loop.run_until_complete(
                        _send_email_task(user.email, notification)
                    )
                    log.status = "sent" if success else "failed"

                elif channel == "sms" and preferences.get("sms"):
                    success = loop.run_until_complete(
                        _send_sms_task(user.phone, notification)
                    )
                    log.status = "sent" if success else "failed"

                elif channel == "push" and preferences.get("push"):
                    # Push would be sent here
                    log.status = "sent"

            except Exception as e:
                log.status = "failed"
                log.error_message = str(e)
                logger.error(f"Error sending {channel}: {str(e)}")

            db.add(log)

        db.commit()
        db.close()

    except self.retry(countdown=60 ** self.request.retries):
        logger.error(
            f"Retrying send_notification_async for {notification_id}"
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")


async def _send_email_task(email: str, notification: Notification) -> bool:
    """Send email task"""
    try:
        template_html = _get_email_template(
            notification_type=notification.type,
            title=notification.title,
            message=notification.message,
            action_url=notification.action_url,
            action_label=notification.action_label,
        )

        response = resend.Emails.send(
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": email,
                "subject": notification.title,
                "html": template_html,
            }
        )

        return response.get("id") is not None
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return False


async def _send_sms_task(phone: str, notification: Notification) -> bool:
    """Send SMS task"""
    try:
        message = f"{notification.title}: {notification.message[:160]}"
        response = sms.send(message, [phone])

        if response.get("SMSMessageData"):
            recipients = response["SMSMessageData"].get("Recipients", [])
            if recipients and recipients[0].get("statusCode") == 101:
                return True

        return False
    except Exception as e:
        logger.error(f"SMS send error: {str(e)}")
        return False
