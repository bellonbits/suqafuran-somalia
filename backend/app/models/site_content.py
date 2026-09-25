from typing import Optional
from sqlmodel import Field, SQLModel


class SiteContentBase(SQLModel):
    key: str = Field(index=True, unique=True)
    value_en: str
    value_so: Optional[str] = Field(default=None)
    page_group: str = Field(index=True)  # e.g., 'landing', 'about', 'nav'


class SiteContent(SiteContentBase, table=True):
    __tablename__ = "site_content"
    id: Optional[int] = Field(default=None, primary_key=True)


class SiteContentRead(SiteContentBase):
    id: int


class SiteContentUpdate(SQLModel):
    value_en: Optional[str] = None
    value_so: Optional[str] = None
