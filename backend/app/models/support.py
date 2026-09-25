from datetime import datetime
from typing import Optional, List, Any
from sqlmodel import SQLModel, Field, JSON, Column
from .common import TimestampModel

class SupportTicketBase(SQLModel):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    subject: str
    status: str = "open"  # "open" | "resolved" | "pending"
    priority: str = "low" # "low" | "medium" | "high"
    category: str = "general"
    
class SupportTicket(SupportTicketBase, TimestampModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Store the entire chat history as JSON
    chat_history: List[dict] = Field(default=[], sa_column=Column(JSON))
    last_agent_response: Optional[str] = None
    admin_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    # Secret handed to the guest who opened the ticket; ids are sequential, so
    # guest reads/continuations must present this instead of just the id.
    guest_token: Optional[str] = Field(default=None, index=True)

class SupportTicketCreate(SupportTicketBase):
    chat_history: List[dict]

class SupportTicketUpdate(SQLModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    priority: Optional[str] = None
