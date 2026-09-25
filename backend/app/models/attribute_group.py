from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class AttributeGroupBase(SQLModel):
    name: str
    slug: str = Field(unique=True, index=True)
    description: Optional[str] = None


class AttributeGroup(AttributeGroupBase, table=True):
    __tablename__ = "attribute_group"
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str = Field(default="active")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AttributeGroupCreate(AttributeGroupBase):
    pass


class AttributeGroupUpdate(SQLModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class AttributeGroupRead(AttributeGroup):
    pass
