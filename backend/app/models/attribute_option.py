from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class AttributeOptionBase(SQLModel):
    attribute_id: int = Field(foreign_key="attribute.id", index=True)
    value: str
    display_name: str
    sort_order: int = Field(default=0)


class AttributeOption(AttributeOptionBase, table=True):
    __tablename__ = "attribute_option"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AttributeOptionCreate(AttributeOptionBase):
    pass


class AttributeOptionUpdate(SQLModel):
    value: Optional[str] = None
    display_name: Optional[str] = None
    sort_order: Optional[int] = None


class AttributeOptionRead(AttributeOption):
    pass
