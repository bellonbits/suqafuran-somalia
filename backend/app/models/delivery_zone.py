from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class DeliveryZoneBase(SQLModel):
    name: str = Field(index=True)
    fee: int  # Fee in KES
    seller_id: int = Field(foreign_key="user.id", index=True)
    status: str = Field(default="active")  # active, inactive


class DeliveryZone(DeliveryZoneBase, table=True, tablename="delivery_zone"):
    id: Optional[int] = Field(default=None, primary_key=True)
    orders_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DeliveryZoneCreate(SQLModel):
    name: str
    fee: int


class DeliveryZoneUpdate(SQLModel):
    name: Optional[str] = None
    fee: Optional[int] = None
    status: Optional[str] = None


class DeliveryZoneRead(DeliveryZone):
    pass
