from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class SubcategoryAttributeBase(SQLModel):
    subcategory_id: int = Field(foreign_key="subcategory.id", index=True)
    attribute_id: int = Field(foreign_key="attribute.id", index=True)
    required: bool = Field(default=False)
    sort_order: int = Field(default=0)


class SubcategoryAttribute(SubcategoryAttributeBase, table=True):
    __tablename__ = "subcategory_attribute"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SubcategoryAttributeCreate(SubcategoryAttributeBase):
    pass


class SubcategoryAttributeUpdate(SQLModel):
    required: Optional[bool] = None
    sort_order: Optional[int] = None


class SubcategoryAttributeRead(SubcategoryAttribute):
    pass
