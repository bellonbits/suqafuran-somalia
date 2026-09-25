from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class AttributeBase(SQLModel):
    attribute_group_id: int = Field(foreign_key="attribute_group.id", index=True)
    name: str
    slug: str = Field(unique=True, index=True)
    field_type: str  # text, number, select, multiselect, checkbox, date, textarea
    required: bool = Field(default=False)
    placeholder: Optional[str] = None
    validation_regex: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class Attribute(AttributeBase, table=True):
    __tablename__ = "attribute"
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str = Field(default="active")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AttributeCreate(AttributeBase):
    pass


class AttributeUpdate(SQLModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    field_type: Optional[str] = None
    required: Optional[bool] = None
    placeholder: Optional[str] = None
    validation_regex: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    status: Optional[str] = None


class AttributeRead(Attribute):
    pass
