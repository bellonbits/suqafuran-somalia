from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class MobileTransaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    phone: str = Field(index=True)
    amount: float
    currency: str = Field(default="KES")
    reference: str = Field(unique=True, index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_linked: bool = Field(default=False)
    is_rejected: bool = Field(default=False)
    linked_promotion_id: Optional[int] = Field(default=None, foreign_key="promotion.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
