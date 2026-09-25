"""Service for sending system messages from Suqafuran to users."""

from datetime import datetime
from sqlmodel import Session, select
from app.models.user import User
from app.models.conversation import Conversation, ConversationMessage
from app.core.logging_config import get_logger

logger = get_logger("system_messaging_service")

# System user ID - should be a reserved ID (1 or a high reserved range)
SYSTEM_USER_ID = 1  # Reserved for Suqafuran system messages
SYSTEM_USER_NAME = "Suqafuran"
SYSTEM_USER_EMAIL = "system@suqafuran.so"


def get_or_create_system_user(db: Session) -> User:
    """Get or create the system user for Suqafuran messages."""
    system_user = db.get(User, SYSTEM_USER_ID)

    if not system_user:
        system_user = User(
            id=SYSTEM_USER_ID,
            email=SYSTEM_USER_EMAIL,
            full_name=SYSTEM_USER_NAME,
            password="",  # System user has no password
            is_verified=True,
            verified_level="tier3",
            is_seller=False,
            phone_verified=True,
            email_verified=True,
        )
        db.add(system_user)
        db.commit()
        db.refresh(system_user)

    return system_user


def send_system_message(
    db: Session,
    recipient_user_id: int,
    message_content: str,
    message_type: str = "general"  # general, promotional, announcement, support
) -> ConversationMessage:
    """
    Send a system message from Suqafuran to a user.

    Args:
        db: Database session
        recipient_user_id: User receiving the message
        message_content: Message text
        message_type: Type of system message for categorization

    Returns:
        The created ConversationMessage
    """
    try:
        system_user = get_or_create_system_user(db)
        recipient = db.get(User, recipient_user_id)

        if not recipient:
            raise ValueError(f"User {recipient_user_id} not found")

        # Get or create conversation between system user and recipient
        conversation = db.exec(
            select(Conversation).where(
                Conversation.seller_id == system_user.id,
                Conversation.customer_id == recipient_user_id
            )
        ).first()

        if not conversation:
            conversation = Conversation(
                seller_id=system_user.id,
                customer_id=recipient_user_id,
                last_message=message_content[:100],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
        else:
            # Update last message
            conversation.last_message = message_content[:100]
            conversation.updated_at = datetime.utcnow()
            db.add(conversation)
            db.commit()

        # Create the message
        msg = ConversationMessage(
            conversation_id=conversation.id,
            sender_id=system_user.id,
            content=message_content,
            created_at=datetime.utcnow()
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        logger.info(f"System message sent to user {recipient_user_id}: {message_type}")
        return msg

    except Exception as e:
        logger.error(f"Failed to send system message to user {recipient_user_id}: {e}")
        db.rollback()
        raise


def send_bulk_system_message(
    db: Session,
    recipient_user_ids: list[int],
    message_content: str,
    message_type: str = "general"
) -> dict:
    """
    Send a system message to multiple users.

    Args:
        db: Database session
        recipient_user_ids: List of user IDs
        message_content: Message text
        message_type: Type of system message

    Returns:
        Dict with success/failure counts
    """
    success_count = 0
    failure_count = 0
    errors = []

    for user_id in recipient_user_ids:
        try:
            send_system_message(db, user_id, message_content, message_type)
            success_count += 1
        except Exception as e:
            failure_count += 1
            errors.append({"user_id": user_id, "error": str(e)})
            logger.warning(f"Failed to send message to user {user_id}: {e}")

    logger.info(f"Bulk system messages: {success_count} sent, {failure_count} failed")
    return {
        "success": success_count,
        "failed": failure_count,
        "errors": errors if errors else None
    }
