from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class ListingAttributeBase(SQLModel):
    listing_id: int = Field(foreign_key="listing.id", index=True)
    attribute_id: int = Field(foreign_key="attribute.id", index=True)
    value: str  # Stored as string, can be JSON for complex types


class ListingAttribute(ListingAttributeBase, table=True):
    __tablename__ = "listing_attribute"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ListingAttributeCreate(ListingAttributeBase):
    pass


class ListingAttributeUpdate(SQLModel):
    value: Optional[str] = None


class ListingAttributeRead(ListingAttribute):
    pass
