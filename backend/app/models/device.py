from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, JSON

class UserDeviceLink(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    device_id: int = Field(foreign_key="device.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Device(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fingerprint_hash: str = Field(unique=True, index=True)
    device_metadata: Optional[Dict[str, Any]] = Field(default={}, sa_column=Column("metadata", JSON))
    is_banned: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    # users: List["User"] = Relationship(back_populates="devices", link_model=UserDeviceLink)
