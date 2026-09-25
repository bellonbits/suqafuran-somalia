from datetime import datetime
from typing import Optional, List, Any
from sqlmodel import Field, SQLModel, Relationship


from sqlalchemy import Column, JSON
from typing import TYPE_CHECKING
from app.models.common import OwnerRead
if TYPE_CHECKING:
    from app.models.user import User


class ListingBase(SQLModel):
    title_en: str = Field(index=True)
    title_so: Optional[str] = Field(default=None)
    description_en: str
    description_so: Optional[str] = Field(default=None)
    price: float
    # Original/"was" price for showing a discount ("Was X | Y% off"). Only
    # meaningful when it's actually higher than `price` -- callers should
    # treat compare_at_price <= price as "no discount to show", not an error.
    compare_at_price: Optional[float] = Field(default=None)
    location: str = Field(index=True)
    condition: str  # New, Used, Refurbished
    category_id: int = Field(foreign_key="category.id", index=True)
    subcategory_id: Optional[int] = Field(default=None, foreign_key="subcategory.id", index=True)
    subsubcategory_id: Optional[int] = Field(default=None, foreign_key="subsubcategory.id", index=True)
    status: str = Field(default="pending", index=True)  # pending, active, closed, reported, deleted
    moderation_status: str = Field(default="pending", index=True)  # pending, approved, rejected
    boost_level: int = Field(default=0)  # 0: none, 1: basic, 2: vip, 3: diamond
    boost_expires_at: Optional[datetime] = None
    currency: str = Field(default="KES")
    images: List[str] = Field(default=[], sa_column=Column(JSON))
    attributes: dict = Field(default={}, sa_column=Column(JSON))
    views: int = Field(default=0)
    leads: int = Field(default=0)
    lang_available: str = Field(default="en") # en, so, both
    rejection_reason: Optional[str] = Field(default=None)
    admin_notes: Optional[dict] = Field(default={}, sa_column=Column(JSON))
    is_negotiable: bool = Field(default=False)

    # Moderation tracking
    moderated_at: Optional[datetime] = Field(default=None)
    moderator_id: Optional[int] = Field(default=None, foreign_key="user.id")
    moderation_notes: Optional[str] = Field(default=None)

    # Approval tracking (separate from moderation)
    approval_status: str = Field(default="pending", index=True)  # pending, approved, rejected
    approved_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    rejected_at: Optional[datetime] = Field(default=None)

    # Sale tracking
    is_sold: bool = Field(default=False, index=True)
    sold_at: Optional[datetime] = Field(default=None)
    sold_via: Optional[str] = Field(default=None)  # "platform" | "external" | "other"

    # Security & Fraud Fields
    image_hashes: Optional[List[str]] = Field(default=[], sa_column=Column(JSON)) # Perceptual hashes for duplicate detection
    fraud_risk_score: int = Field(default=0, index=True) # 0-100 calculated by AI
    fraud_flags: Optional[List[str]] = Field(default=[], sa_column=Column(JSON)) # Specific rule violations


class Listing(ListingBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    owner: Optional["User"] = Relationship(
        back_populates="listings",
        sa_relationship_kwargs={"foreign_keys": "Listing.owner_id"}
    )


class ListingRead(ListingBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    owner: Optional[OwnerRead] = None


class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name_en: str = Field(index=True)
    name_so: Optional[str] = Field(default=None)
    slug: str = Field(unique=True)
    icon_name: str
    image_url: Optional[str] = None
    attributes_schema: dict = Field(default={}, sa_column=Column(JSON))


class SubSubCategory(SQLModel, table=True):
    __tablename__ = "subsubcategory"

    id: Optional[int] = Field(default=None, primary_key=True)
    name_en: str = Field(index=True)
    name_so: Optional[str] = Field(default=None)
    slug: str = Field(index=True)
    image_url: Optional[str] = None
    subcategory_id: int = Field(foreign_key="subcategory.id")
    attributes_schema: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    brands: Optional[list] = Field(default=None, sa_column=Column(JSON))

