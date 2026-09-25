from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class ConversationMessageBase(SQLModel):
    conversation_id: int = Field(foreign_key="conversation.id", index=True)
    sender_id: int = Field(foreign_key="user.id", index=True)
    content: str


class ConversationMessage(ConversationMessageBase, table=True, tablename="conversation_message"):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationBase(SQLModel):
    seller_id: int = Field(foreign_key="user.id", index=True)
    customer_id: int = Field(foreign_key="user.id", index=True)


class Conversation(ConversationBase, table=True, tablename="conversation"):
    id: Optional[int] = Field(default=None, primary_key=True)
    last_message: Optional[str] = None
    unread_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationMessageCreate(SQLModel):
    content: str


class ConversationRead(SQLModel):
    id: int
    customer_name: str
    last_message: Optional[str]
    unread_count: int
    updated_at: datetime


class ConversationDetailRead(SQLModel):
    id: int
    customer_name: str
    last_message: Optional[str]
    unread_count: int
    updated_at: datetime
    messages: list = []
