import enum
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class PlacementType(str, enum.Enum):
    """Types of advertising placements"""
    FEATURED_PRODUCT = "featured_product"
    FEATURED_SHOP = "featured_shop"
    CATEGORY_FEATURED = "category_featured"


class AdvertisementStatus(str, enum.Enum):
    """Status of an advertisement"""
    PENDING_PAYMENT = "pending_payment"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class BannerStatus(str, enum.Enum):
    """Status of a homepage banner"""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    EXPIRED = "expired"
    PAUSED = "paused"


class AdvertisingPlan(SQLModel, table=True):
    """Advertising placement types and pricing"""
    __tablename__ = "advertising_plan"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)  # "Featured Product", "Featured Shop", etc.
    placement_type: PlacementType = Field(index=True)
    description: str

    # Pricing (in KES) — can use either per-day or per-week
    price_per_day: Optional[float] = None
    price_per_week: Optional[float] = None
    price_per_month: Optional[float] = None

    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Advertisement(SQLModel, table=True):
    """Advertisement campaign for a seller"""
    __tablename__ = "advertisement"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    listing_id: Optional[int] = Field(foreign_key="listing.id", index=True)  # For featured products
    plan_id: int = Field(foreign_key="advertising_plan.id", index=True)

    placement_type: PlacementType = Field(index=True)

    # Duration
    start_date: datetime = Field(index=True)
    end_date: datetime = Field(index=True)

    # Payment
    amount_paid: float  # Total paid in KES
    payment_reference: str  # M-Pesa reference

    status: AdvertisementStatus = Field(default=AdvertisementStatus.PENDING_PAYMENT, index=True)

    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AdvertisementStats(SQLModel, table=True):
    """Track impressions and clicks for each advertisement"""
    __tablename__ = "advertisement_stats"

    id: Optional[int] = Field(default=None, primary_key=True)
    advertisement_id: int = Field(foreign_key="advertisement.id", unique=True, index=True)

    impressions: int = Field(default=0)  # Page loads / view count
    clicks: int = Field(default=0)  # Click-through count

    # Calculated on-the-fly: CTR = (clicks / impressions) * 100

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HomepageBanner(SQLModel, table=True):
    """Premium homepage banner — admin-only creation"""
    __tablename__ = "homepage_banner"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)

    # Banner content
    title: str  # Headline
    subtitle: Optional[str] = None  # Secondary text
    image_url: str  # Desktop banner (1200x400)
    mobile_image_url: Optional[str] = None  # Mobile banner (600x300)

    # CTA
    button_text: str = Field(default="Shop Now")  # e.g., "Shop Now", "View Collection"
    button_link: str  # Destination: shop URL, listing URL, category URL, or external URL

    # Duration & Priority
    start_date: datetime = Field(index=True)
    end_date: datetime = Field(index=True)
    priority: int = Field(default=50)  # 1-100, higher = shown first in rotation

    status: BannerStatus = Field(default=BannerStatus.DRAFT, index=True)

    # Admin metadata
    created_by_admin_id: int = Field(foreign_key="user.id")  # Admin who created it

    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HomepageBannerStats(SQLModel, table=True):
    """Track impressions and clicks for homepage banners"""
    __tablename__ = "homepage_banner_stats"

    id: Optional[int] = Field(default=None, primary_key=True)
    banner_id: int = Field(foreign_key="homepage_banner.id", unique=True, index=True)

    impressions: int = Field(default=0)
    clicks: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
