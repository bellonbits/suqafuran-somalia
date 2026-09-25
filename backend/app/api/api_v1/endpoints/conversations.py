from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.conversation import (
    Conversation,
    ConversationMessage,
    ConversationMessageCreate,
    ConversationRead,
    ConversationDetailRead,
)
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[ConversationRead])
def list_conversations(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    List conversations for the current seller (paginated).
    """
    statement = (
        select(Conversation, User.full_name)
        .join(User, Conversation.customer_id == User.id)
        .where(Conversation.seller_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    results = db.exec(statement).all()

    conversations = []
    for conv, customer_name in results:
        conversations.append(
            ConversationRead(
                id=conv.id,
                customer_name=customer_name or "Unknown",
                last_message=conv.last_message,
                unread_count=conv.unread_count,
                updated_at=conv.updated_at,
            )
        )

    return conversations


@router.get("/{conversation_id}", response_model=ConversationDetailRead)
def get_conversation_details(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    conversation_id: int,
) -> Any:
    """
    Get messages in a conversation.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")

    # Get customer name
    customer = db.get(User, conversation.customer_id)
    customer_name = customer.full_name if customer else "Unknown"

    # Get all messages in this conversation
    statement = (
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at.asc())
    )
    messages = db.exec(statement).all()

    # Reset unread count
    conversation.unread_count = 0
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return ConversationDetailRead(
        id=conversation.id,
        customer_name=customer_name,
        last_message=conversation.last_message,
        unread_count=0,
        updated_at=conversation.updated_at,
        messages=[
            {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in messages
        ],
    )


@router.post("/{conversation_id}/messages", response_model=ConversationMessage)
def send_message(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    conversation_id: int,
    message_in: ConversationMessageCreate,
) -> Any:
    """
    Send a message in a conversation.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to message in this conversation")

    # Create message
    message = ConversationMessage(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=message_in.content,
    )
    db.add(message)

    # Update conversation's last message and timestamp
    conversation.last_message = message_in.content
    db.add(conversation)

    db.commit()
    db.refresh(message)
    return message
