from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class ReviewBase(SQLModel):
    product_id: int = Field(foreign_key="listing.id", index=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    customer_name: str
    rating: int = Field(ge=1, le=5)  # 1-5 rating
    comment: str


class Review(ReviewBase, table=True, tablename="review"):
    id: Optional[int] = Field(default=None, primary_key=True)
    response: Optional[str] = None
    responded_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReviewCreate(SQLModel):
    product_id: int
    customer_name: str
    rating: int
    comment: str


class ReviewUpdate(SQLModel):
    rating: Optional[int] = None
    comment: Optional[str] = None


class ReviewResponse(SQLModel):
    response: str


class ReviewRead(Review):
    pass
