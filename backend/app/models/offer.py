from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship


class OfferBase(SQLModel):
    listing_id: int = Field(foreign_key="listing.id", index=True)
    buyer_id: int = Field(foreign_key="user.id", index=True)
    amount: float
    message: Optional[str] = None
    status: str = Field(default="pending", index=True)


class Offer(OfferBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OfferRead(OfferBase):
    id: int
    created_at: datetime
    updated_at: datetime


class OfferCreate(SQLModel):
    listing_id: int
    amount: float
    message: Optional[str] = None


class OfferUpdate(SQLModel):
    status: str  # accepted, rejected, withdrawn
