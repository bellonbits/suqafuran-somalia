from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Column, JSON

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    type: str  # message, price_drop, ad_approved, etc.
    data: dict = Field(default={}, sa_column=Column(JSON))
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
