from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel
from app.api import deps
from app.crud.crud_message import crud_message
from app.models.message import Message
from app.services.moderation_service import moderation_service
from app.core.security import risk_security
from app.models.user import User
from app.services.user_notification_service import user_notification_service

router = APIRouter()

class MessageCreate(SQLModel):
    receiver_id: int
    content: str
    listing_id: Optional[int] = None

@router.post("/", response_model=Message)
def send_message(
    *,
    db: Session = Depends(deps.get_db),
    message_in: MessageCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Send a new message.
    """
    # 1. Risk-Based Rate Limiting
    risk_security.check_messaging_limit(current_user)

    # 1b. An admin can suspend a specific conversation thread (e.g. mid
    # investigation) -- check before it's created so re-opening it with a
    # different listing_id can't be used to route around a suspension.
    existing_conversation = crud_message.get_conversation_for_pair(
        db, user_a_id=current_user.id, user_b_id=message_in.receiver_id, listing_id=message_in.listing_id
    )
    if existing_conversation and existing_conversation.status == "suspended":
        raise HTTPException(status_code=403, detail="This conversation has been suspended by Suqafuran support.")

    # 2. Content Moderation
    is_flagged, reason = moderation_service.analyze_message(db, current_user, message_in.content)
    if is_flagged:
        raise HTTPException(
            status_code=403,
            detail=f"Message blocked due to suspicious content: {reason}. To maintain safety, avoid sharing phone numbers or external links."
        )

    msg = crud_message.create(db, obj_in=message_in.model_dump(), sender_id=current_user.id)

    sender_name = current_user.full_name or "Someone"
    preview = msg.content[:80]

    # Queue notifications as background tasks to avoid blocking the response
    try:
        from app.tasks.notifications import send_message_notifications
        send_message_notifications.delay(
            message_id=msg.id,
            sender_id=current_user.id,
            sender_name=sender_name,
            receiver_id=message_in.receiver_id,
            content=msg.content,
            preview=preview,
            listing_id=msg.listing_id
        )
    except Exception:
        # If background task fails, continue anyway - message was still created
        pass

    return msg


@router.get("/conversations", response_model=List[Any])
def get_my_conversations(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all conversations for the current user.
    """
    return crud_message.get_user_conversations(db, user_id=current_user.id)

@router.get("/{other_user_id}", response_model=List[Message])
def get_conversation(
    *,
    db: Session = Depends(deps.get_db),
    other_user_id: int,
    listing_id: int = None,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get messages between current user and another user.
    """
    return crud_message.get_conversation(
        db, user_id=current_user.id, other_user_id=other_user_id, listing_id=listing_id
    )

@router.post("/{other_user_id}/read")
def mark_read(
    *,
    db: Session = Depends(deps.get_db),
    other_user_id: int,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark all messages from other_user_id to current_user as read.
    """
    crud_message.mark_as_read(db, user_id=current_user.id, other_user_id=other_user_id)
    return {"ok": True}
