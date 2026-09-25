from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class SellerSettingsBase(SQLModel):
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)
    push_notifications: bool = Field(default=True)
    email_notifications: bool = Field(default=True)
    order_alerts: bool = Field(default=True)
    low_stock_alerts: bool = Field(default=True)


class SellerSettings(SellerSettingsBase, table=True):
    __tablename__ = "seller_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SellerSettingsCreate(SQLModel):
    push_notifications: bool = True
    email_notifications: bool = True
    order_alerts: bool = True
    low_stock_alerts: bool = True


class SellerSettingsUpdate(SQLModel):
    push_notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None
    order_alerts: Optional[bool] = None
    low_stock_alerts: Optional[bool] = None


class SellerSettingsRead(SellerSettings):
    pass
