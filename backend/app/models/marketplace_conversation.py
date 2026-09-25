from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class MarketplaceConversation(SQLModel, table=True):
    """
    One row per (buyer, seller, listing) thread between a real buyer and
    seller on a listing. Created automatically the moment a buyer's first
    message to a seller is sent -- admin visibility into marketplace chats
    doesn't depend on anyone filing a report.

    Deliberately a separate table from `conversation`/`conversation_message`
    (app/models/conversation.py), which is an unrelated, pre-existing
    feature for Suqafuran-as-system sending messages to users.
    """
    __tablename__ = "marketplace_conversation"

    id: Optional[int] = Field(default=None, primary_key=True)
    buyer_id: int = Field(foreign_key="user.id", index=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_message_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    last_message_preview: Optional[str] = None

    buyer_unread_count: int = Field(default=0)
    seller_unread_count: int = Field(default=0)
    message_count: int = Field(default=0)

    # active, closed, flagged, suspended (suspended blocks further sends)
    status: str = Field(default="active", index=True)
    admin_reviewed: bool = Field(default=False)
