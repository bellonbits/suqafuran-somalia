from typing import Optional
from sqlmodel import Field, SQLModel, Relationship


class NotificationPreferencesBase(SQLModel):
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    email_messages: bool = Field(default=True)
    email_offers: bool = Field(default=True)
    email_price_drops: bool = Field(default=True)
    email_search_matches: bool = Field(default=True)
    email_order_updates: bool = Field(default=True)
    email_listings: bool = Field(default=True)


class NotificationPreferences(NotificationPreferencesBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class NotificationPreferencesRead(NotificationPreferencesBase):
    id: int


class NotificationPreferencesUpdate(SQLModel):
    email_messages: Optional[bool] = None
    email_offers: Optional[bool] = None
    email_price_drops: Optional[bool] = None
    email_search_matches: Optional[bool] = None
    email_order_updates: Optional[bool] = None
    email_listings: Optional[bool] = None
