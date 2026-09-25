from typing import List, Optional
from sqlmodel import Session, select, or_, and_
from app.models.message import Message
from app.models.marketplace_conversation import MarketplaceConversation as Conversation
from datetime import datetime

class CRUDMessage:
    def get_conversation_for_pair(
        self, db: Session, *, user_a_id: int, user_b_id: int, listing_id: Optional[int] = None
    ) -> Optional[Conversation]:
        """Look up the conversation row for a pair (+ optional listing) without creating one."""
        pair = sorted([user_a_id, user_b_id])
        statement = select(Conversation).where(
            Conversation.buyer_id.in_(pair), Conversation.seller_id.in_(pair)
        )
        statement = statement.where(Conversation.listing_id == listing_id) if listing_id else statement.where(Conversation.listing_id.is_(None))
        return db.exec(statement).first()

    def _find_or_create_conversation(
        self, db: Session, *, sender_id: int, receiver_id: int, listing_id: Optional[int]
    ) -> Conversation:
        existing = self.get_conversation_for_pair(db, user_a_id=sender_id, user_b_id=receiver_id, listing_id=listing_id)
        if existing:
            return existing

        # A listing's owner is always the seller side of the thread. With no
        # listing context, whoever sends the first message is treated as the
        # buyer/initiator -- there's no other signal to determine roles from.
        seller_id = None
        if listing_id:
            from app.models.listing import Listing
            listing = db.get(Listing, listing_id)
            if listing and listing.owner_id in (sender_id, receiver_id):
                seller_id = listing.owner_id
        if seller_id:
            buyer_id = receiver_id if seller_id == sender_id else sender_id
        else:
            buyer_id, seller_id = sender_id, receiver_id

        conversation = Conversation(buyer_id=buyer_id, seller_id=seller_id, listing_id=listing_id)
        db.add(conversation)
        db.flush()
        return conversation

    def create(self, db: Session, *, obj_in: dict, sender_id: int) -> Message:
        receiver_id = obj_in["receiver_id"]
        listing_id = obj_in.get("listing_id")
        content = obj_in["content"]

        conversation = self._find_or_create_conversation(
            db, sender_id=sender_id, receiver_id=receiver_id, listing_id=listing_id
        )

        db_obj = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            listing_id=listing_id,
            conversation_id=conversation.id,
            content=content,
        )
        db.add(db_obj)

        now = datetime.utcnow()
        conversation.last_message_at = now
        conversation.last_message_preview = content[:200]
        conversation.message_count += 1
        conversation.updated_at = now
        if receiver_id == conversation.buyer_id:
            conversation.buyer_unread_count += 1
        elif receiver_id == conversation.seller_id:
            conversation.seller_unread_count += 1
        db.add(conversation)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_conversation(
        self, db: Session, *, user_id: int, other_user_id: int, listing_id: Optional[int] = None
    ) -> List[Message]:
        statement = select(Message).where(
            or_(
                and_(Message.sender_id == user_id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == user_id)
            )
        )
        if listing_id:
            statement = statement.where(Message.listing_id == listing_id)
        
        statement = statement.order_by(Message.created_at)
        return db.exec(statement).all()

    def get_user_conversations(self, db: Session, *, user_id: int) -> List[dict]:
        from app.models.user import User
        # Fetch messages involving the user and join with the other participant's profile
        statement = select(Message, User).where(
            or_(Message.sender_id == user_id, Message.receiver_id == user_id)
        ).join(
            User, 
            or_(
                and_(Message.sender_id == user_id, Message.receiver_id == User.id),
                and_(Message.receiver_id == user_id, Message.sender_id == User.id)
            )
        ).order_by(Message.created_at.desc())
        
        results = db.exec(statement).all()
        
        conversations = {}
        unread_counts: dict = {}
        for msg, user_obj in results:
            other_id = user_obj.id
            if other_id not in conversations:
                conversations[other_id] = {
                    "other_user_id": other_id,
                    "other_user_name": user_obj.full_name,
                    "other_user_avatar": user_obj.avatar_url,
                    "last_message": msg.content,
                    "last_message_at": msg.created_at.isoformat() if msg.created_at else None,
                    "unread_count": 0,
                    "listing_id": msg.listing_id,
                }
            # Count unread messages sent to the current user
            if msg.receiver_id == user_id and not msg.is_read:
                conversations[other_id]["unread_count"] = conversations[other_id].get("unread_count", 0) + 1

        return list(conversations.values())

    def mark_as_read(self, db: Session, *, user_id: int, other_user_id: int) -> None:
        statement = select(Message).where(
            Message.sender_id == other_user_id,
            Message.receiver_id == user_id,
            Message.is_read == False,  # noqa: E712
        )
        messages = db.exec(statement).all()
        touched_conversation_ids = set()
        for msg in messages:
            msg.is_read = True
            db.add(msg)
            if msg.conversation_id:
                touched_conversation_ids.add(msg.conversation_id)

        for conv_id in touched_conversation_ids:
            conversation = db.get(Conversation, conv_id)
            if not conversation:
                continue
            if user_id == conversation.buyer_id:
                conversation.buyer_unread_count = 0
            elif user_id == conversation.seller_id:
                conversation.seller_unread_count = 0
            db.add(conversation)

        db.commit()

crud_message = CRUDMessage()
