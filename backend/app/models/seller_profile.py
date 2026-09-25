from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class SellerProfileBase(SQLModel):
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)
    shop_name: str
    description: Optional[str] = None
    phone: str
    email: str
    location: str


class SellerProfile(SellerProfileBase, table=True, tablename="seller_profile"):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SellerProfileCreate(SQLModel):
    shop_name: str
    description: Optional[str] = None
    phone: str
    email: str
    location: str


class SellerProfileUpdate(SQLModel):
    shop_name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None


class SellerProfileRead(SellerProfile):
    pass
