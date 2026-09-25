from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Feedback(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    author_id: int = Field(foreign_key="user.id")
    target_user_id: int = Field(foreign_key="user.id")
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id")
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
