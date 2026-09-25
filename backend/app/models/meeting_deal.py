import enum
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, String

class MeetingResponse(str, enum.Enum):
    YES = "yes"
    NO = "no"
    NOT_YET = "not_yet"

class Meeting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listing.id")
    buyer_id: int = Field(foreign_key="user.id")
    seller_id: int = Field(foreign_key="user.id")
    buyer_response: Optional[str] = Field(default=None, sa_column=Column(String))
    seller_response: Optional[str] = Field(default=None, sa_column=Column(String))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DealOutcome(str, enum.Enum):
    BOUGHT = "bought"
    NOT_BOUGHT = "not_bought"
    CANCELLED = "cancelled"

class Deal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listing.id")
    buyer_id: int = Field(foreign_key="user.id")
    seller_id: int = Field(foreign_key="user.id")
    outcome: str = Field(default="pending", sa_column=Column(String))
    buyer_confirmed: bool = Field(default=False)
    seller_confirmed: bool = Field(default=False)
    buyer_confirmed_at: Optional[datetime] = Field(default=None)
    seller_confirmed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
