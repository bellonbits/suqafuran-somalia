from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship


class SavedSearchBase(SQLModel):
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str
    query: str
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    location: Optional[str] = None
    is_active: bool = Field(default=True, index=True)


class SavedSearch(SavedSearchBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    last_matched_at: Optional[datetime] = None
    match_count: int = Field(default=0)


class SavedSearchRead(SavedSearchBase):
    id: int
    created_at: datetime
    last_matched_at: Optional[datetime]
    match_count: int


class SavedSearchCreate(SQLModel):
    name: str
    query: str
    category_id: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    location: Optional[str] = None


class SavedSearchUpdate(SQLModel):
    name: Optional[str] = None
    query: Optional[str] = None
    category_id: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None
