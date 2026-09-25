from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON


class CheckoutReceiptBase(SQLModel):
    buyer_id: int = Field(foreign_key="user.id", index=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    # [{listing_id, title, price, quantity}, ...] — denormalized so the
    # receipt stays readable even if a listing is later edited or deleted.
    items: list = Field(default=[], sa_column=Column(JSON))
    total_amount: float = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class CheckoutReceipt(CheckoutReceiptBase, table=True):
    __tablename__ = "checkout_receipt"
    id: Optional[int] = Field(default=None, primary_key=True)
