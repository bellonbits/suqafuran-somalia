from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Favorite(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    listing_id: int = Field(foreign_key="listing.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
