from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class SavedAddress(SQLModel, table=True):
    """A named delivery/pickup location a user has saved for quick reuse,
    e.g. picked once in the location picker and saved as 'Home' or 'Work'."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    label: str = Field(default="Saved address")
    formatted_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
