from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String

if TYPE_CHECKING:
    from app.models.user import User

class Wallet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    balance: float = Field(default=0.0)
    currency: str = Field(default="KES")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="wallet")
    transactions: List["Transaction"] = Relationship(back_populates="wallet")

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    wallet_id: int = Field(foreign_key="wallet.id")
    amount: float
    type: str  # deposit, withdrawal, payment (for boost), refund
    description: str
    status: str = Field(default="completed")  # pending, completed, failed
    reference: str = Field(index=True)  # External ref or generated UUID
    created_at: datetime = Field(default_factory=datetime.utcnow)

    wallet: Optional[Wallet] = Relationship(back_populates="transactions")

class Voucher(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    amount: float
    is_redeemed: bool = Field(default=False)
    redeemed_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    redeemed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
