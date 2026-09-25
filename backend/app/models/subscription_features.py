"""
Subscription features models - Verified badges, Marketing codes, Analytics, etc.
"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, JSON
from sqlalchemy import Column


class IdentityVerification(SQLModel, table=True):
    """Track seller identity verification status."""
    __tablename__ = "identity_verification"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)

    # Verification type
    id_type: str  # "national_id", "passport", "business_reg"
    id_number: str  # Encrypted in production
    id_image_url: Optional[str] = None

    # Phone and email verification
    phone_verified: bool = Field(default=False)
    email_verified: bool = Field(default=False)

    # Status
    status: str = Field(default="pending")  # "pending", "approved", "rejected"
    rejection_reason: Optional[str] = None

    verified_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DiscountCode(SQLModel, table=True):
    """Marketing codes / Discount codes created by sellers."""
    __tablename__ = "discount_code"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)

    # Code
    code: str = Field(unique=True, index=True)  # "SUMMER10", "WELCOME500"
    description: Optional[str] = None

    # Discount type
    discount_type: str  # "percentage", "fixed_amount"
    discount_value: float  # 10 for 10%, 500 for KSh 500 off
    min_purchase_amount: Optional[float] = None  # Minimum order value

    # Validity
    expiry_date: date
    max_uses: Optional[int] = None  # None = unlimited
    current_uses: int = Field(default=0, index=True)

    # Performance tracking
    revenue_generated: float = Field(default=0.0)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AnalyticsEvent(SQLModel, table=True):
    """Track analytics events (views, clicks, messages, calls, etc)."""
    __tablename__ = "analytics_event"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id", index=True)

    # Event type
    event_type: str = Field(index=True)  # "shop_visit", "product_view", "product_click", "whatsapp_click", "call_click", "message_click"

    # Metadata
    source: Optional[str] = None  # "search", "category", "homepage", "direct", "recommendation"
    search_query: Optional[str] = None  # If from search, what was searched
    user_id: Optional[int] = None  # Who triggered the event (if available)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ShopBranding(SQLModel, table=True):
    """Custom branding for Business+ shops."""
    __tablename__ = "shop_branding"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)

    # Branding assets
    banner_url: Optional[str] = None
    banner_alt_text: Optional[str] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = None  # Hex color: "#3498db"

    # About section
    about_text: Optional[str] = None
    business_since: Optional[str] = None
    business_location: Optional[str] = None

    # Theme
    theme: str = Field(default="light")  # "light", "dark", "custom"

    # Collections/Featured sections
    featured_collection_ids: List[int] = Field(default=[], sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StaffAccount(SQLModel, table=True):
    """Staff account for Business+ shops."""
    __tablename__ = "staff_account"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    # Role and permissions
    role: str  # "manager", "sales", "inventory", "support"
    permissions: Dict[str, bool] = Field(default={}, sa_column=Column(JSON))
    # Example: {
    #   "manage_products": True,
    #   "manage_orders": True,
    #   "reply_messages": True,
    #   "update_inventory": True,
    #   "view_analytics": True,
    #   "manage_staff": False
    # }

    is_active: bool = Field(default=True, index=True)
    last_login: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class APIKey(SQLModel, table=True):
    """API keys for Enterprise shops."""
    __tablename__ = "api_key"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)

    # Key management
    name: str  # e.g., "Production Key", "Integration API"
    key_hash: str = Field(unique=True, index=True)  # Hashed for security
    key_prefix: str  # e.g., "sk_live_" for display

    # Scopes
    scopes: List[str] = Field(default=[], sa_column=Column(JSON))
    # Example: ["products:read", "products:write", "orders:read", "inventory:write"]

    # Usage tracking
    rate_limit: int = Field(default=10000)  # Requests per day
    requests_today: int = Field(default=0)
    requests_total: int = Field(default=0)

    # Status
    is_active: bool = Field(default=True, index=True)
    last_used: Optional[datetime] = None
    last_used_ip: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None


class CustomDomain(SQLModel, table=True):
    """Custom domain for Enterprise shops."""
    __tablename__ = "custom_domain"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)

    # Domain info
    domain: str = Field(unique=True, index=True)  # e.g., "shop.rahmo.com"
    is_verified: bool = Field(default=False, index=True)

    # Verification
    verification_token: str  # DNS TXT record value
    verification_type: str = Field(default="cname")  # "cname" or "txt"

    # SSL
    ssl_status: str = Field(default="pending")  # "pending", "active", "expired"
    ssl_certificate_url: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AdvertisingCredit(SQLModel, table=True):
    """Monthly advertising credits for Business+ plans."""
    __tablename__ = "advertising_credit"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)

    # Monthly credit
    month: str = Field(index=True)  # "2026-07"
    balance_kes: float = Field(default=0.0)
    total_allocated: float  # Original amount for the month

    # Usage
    spent_kes: float = Field(default=0.0)
    expires_at: date  # Date when unused credits expire

    # History
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
