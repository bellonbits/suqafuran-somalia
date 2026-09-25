from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship


class PriceAlertBase(SQLModel):
    listing_id: int = Field(foreign_key="listing.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    target_price: Optional[float] = None
    is_active: bool = Field(default=True, index=True)


class PriceAlert(PriceAlertBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    last_notified_at: Optional[datetime] = None
    last_price: Optional[float] = None


class PriceAlertRead(PriceAlertBase):
    id: int
    created_at: datetime
    last_notified_at: Optional[datetime]
    last_price: Optional[float]


class PriceAlertCreate(SQLModel):
    listing_id: int
    target_price: Optional[float] = None
