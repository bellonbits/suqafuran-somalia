from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender_id: int = Field(foreign_key="user.id")
    receiver_id: int = Field(foreign_key="user.id")
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id")
    conversation_id: Optional[int] = Field(default=None, foreign_key="marketplace_conversation.id", index=True)
    content: str
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
