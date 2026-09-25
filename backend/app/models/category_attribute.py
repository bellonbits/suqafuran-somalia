from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CategoryAttributeBase(SQLModel):
    category_id: int = Field(foreign_key="category.id", index=True)
    attribute_id: int = Field(foreign_key="attribute.id", index=True)
    required: bool = Field(default=False)
    sort_order: int = Field(default=0)


class CategoryAttribute(CategoryAttributeBase, table=True):
    __tablename__ = "category_attribute"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CategoryAttributeCreate(CategoryAttributeBase):
    pass


class CategoryAttributeUpdate(SQLModel):
    required: Optional[bool] = None
    sort_order: Optional[int] = None


class CategoryAttributeRead(CategoryAttribute):
    pass
