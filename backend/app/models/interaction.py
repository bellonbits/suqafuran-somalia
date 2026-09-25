import enum
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, String

class InteractionType(str, enum.Enum):
    call = "call"
    whatsapp = "whatsapp"
    message = "message"

class Interaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id")
    receipt_id: Optional[int] = Field(default=None, foreign_key="checkout_receipt.id", index=True)
    buyer_id: int = Field(foreign_key="user.id")
    type: str = Field(sa_column=Column(String)) # Force plain string to bypass Enum name issues
    created_at: datetime = Field(default_factory=datetime.utcnow)
