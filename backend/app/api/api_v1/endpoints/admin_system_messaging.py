"""Admin endpoints for sending system messages to users."""

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from pydantic import BaseModel
from app.api import deps
from app.models.user import User
from app.services.system_messaging_service import send_system_message, send_bulk_system_message
from app.core.logging_config import get_logger

logger = get_logger("admin_system_messaging")

router = APIRouter()


class SendSystemMessageRequest(BaseModel):
    recipient_user_id: int
    message: str
    message_type: str = "general"  # general, promotional, announcement, support


class SendBulkMessageRequest(BaseModel):
    recipient_user_ids: list[int]
    message: str
    message_type: str = "general"
    dry_run: bool = False  # If True, only validates but doesn't send


class SendBulkMessageResponse(BaseModel):
    success: int
    failed: int
    errors: Optional[list] = None


def _check_admin_permission(current_user: User):
    """Verify user has admin permission."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can send system messages"
        )


@router.post("/send")
def send_system_message_endpoint(
    payload: SendSystemMessageRequest,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Send a system message from Suqafuran to a user.

    Message Types:
    - general: General announcement or notification
    - promotional: Marketing/promotional message
    - announcement: Important platform announcement
    - support: Support or help message
    """
    _check_admin_permission(current_user)

    if not payload.message or len(payload.message.strip()) < 1:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(payload.message) > 5000:
        raise HTTPException(status_code=400, detail="Message too long (max 5000 characters)")

    try:
        msg = send_system_message(
            db=db,
            recipient_user_id=payload.recipient_user_id,
            message_content=payload.message,
            message_type=payload.message_type
        )

        return {
            "status": "sent",
            "message_id": msg.id,
            "recipient_id": payload.recipient_user_id,
            "message_type": payload.message_type
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send system message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message"
        )


@router.post("/send-bulk", response_model=SendBulkMessageResponse)
def send_bulk_system_message_endpoint(
    payload: SendBulkMessageRequest,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Send a system message to multiple users.

    Useful for:
    - Platform-wide announcements
    - Promotional campaigns
    - Important updates to specific user segments
    """
    _check_admin_permission(current_user)

    if not payload.message or len(payload.message.strip()) < 1:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(payload.message) > 5000:
        raise HTTPException(status_code=400, detail="Message too long (max 5000 characters)")

    if not payload.recipient_user_ids:
        raise HTTPException(status_code=400, detail="At least one recipient required")

    if len(payload.recipient_user_ids) > 10000:
        raise HTTPException(status_code=400, detail="Too many recipients (max 10,000)")

    # Check for duplicates in recipient list
    unique_ids = set(payload.recipient_user_ids)
    if len(unique_ids) < len(payload.recipient_user_ids):
        logger.warning(f"Duplicate user IDs in bulk message request")

    if payload.dry_run:
        # Just validate, don't send
        return {
            "success": len(unique_ids),
            "failed": 0,
            "errors": None
        }

    try:
        result = send_bulk_system_message(
            db=db,
            recipient_user_ids=list(unique_ids),
            message_content=payload.message,
            message_type=payload.message_type
        )

        logger.info(
            f"Bulk system message sent: {result['success']} success, "
            f"{result['failed']} failed. Type: {payload.message_type}"
        )

        return result

    except Exception as e:
        logger.error(f"Failed to send bulk system messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send messages"
        )
