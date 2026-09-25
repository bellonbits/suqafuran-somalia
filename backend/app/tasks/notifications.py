"""
Background tasks for sending message notifications (push, email, in-app).
"""
from celery import shared_task
from celery.utils.log import get_task_logger
from typing import Optional

logger = get_task_logger(__name__)


@shared_task(bind=True, max_retries=2, queue="notifications")
def send_message_notifications(
    self,
    message_id: int,
    sender_id: int,
    sender_name: str,
    receiver_id: int,
    content: str,
    preview: str,
    listing_id: Optional[int] = None,
):
    """
    Send all notifications for a new message (push, email, in-app).
    Runs asynchronously in background so message response isn't blocked.
    """
    try:
        from app.core.config import settings
        from app.models.user import User
        from app.db import SessionLocal
        from app.crud.crud_notification import crud_notification
        from app.utils.push import send_push_to_user
        from app.services.user_notification_service import user_notification_service

        db = SessionLocal()

        try:
            # 1. In-app notification
            try:
                crud_notification.create(
                    db,
                    obj_in={
                        "type": "message",
                        "data": {
                            "message_id": message_id,
                            "sender_id": sender_id,
                            "sender_name": sender_name,
                            "content": content,
                            "listing_id": listing_id,
                            "message": f"New message from {sender_name}: \"{preview}\""
                        }
                    },
                    user_id=receiver_id
                )
            except Exception as e:
                logger.warning(f"Failed to create in-app notification: {e}")

            # 2. Push notification
            try:
                send_push_to_user(
                    db,
                    user_id=receiver_id,
                    title=f"New message from {sender_name}",
                    body=preview,
                    data={
                        "type": "message",
                        "sender_id": str(sender_id),
                        "listing_id": str(listing_id or ""),
                        "path": f"/messages/{sender_id}",
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to send push notification: {e}")

            # 3. Email notification
            try:
                receiver = db.get(User, receiver_id)
                if receiver:
                    user_notification_service.notify_new_message(
                        receiver=receiver,
                        sender_name=sender_name,
                        message_content=content,
                    )
            except Exception as e:
                logger.warning(f"Failed to send email notification: {e}")

            logger.info(f"Message notifications sent for message {message_id}")
            return {"status": "success"}

        finally:
            db.close()

    except Exception as exc:
        logger.error(f"Failed to send message notifications: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
