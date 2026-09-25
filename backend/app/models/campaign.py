from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CampaignBase(SQLModel):
    name: str = Field(index=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    status: str = Field(default="active")  # active, inactive, completed


class Campaign(CampaignBase, table=True, tablename="campaign"):
    id: Optional[int] = Field(default=None, primary_key=True)
    clicks: int = Field(default=0)
    conversions: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CampaignCreate(SQLModel):
    name: str


class CampaignUpdate(SQLModel):
    name: Optional[str] = None
    status: Optional[str] = None


class CampaignRead(Campaign):
    pass
