import enum
from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON


class SubscriptionPlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"


class BillingFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


class BillingStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PAYMENT_FAILED = "payment_failed"


class SubscriptionPlan(SQLModel, table=True):
    """Defines subscription tiers: Free, Pro, etc."""
    __tablename__ = "subscription_plan"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)  # "free", "pro"
    display_name: str  # "Free Tier", "Pro Shop"
    description: Optional[str] = None

    # Pricing (in KES)
    monthly_price: float = Field(default=0.0)
    annual_price: float = Field(default=0.0)

    # Features
    max_products: Optional[int] = None  # None = unlimited
    has_analytics: bool = Field(default=False)
    has_verified_badge: bool = Field(default=False)
    has_priority_ranking: bool = Field(default=False)
    has_custom_branding: bool = Field(default=False)
    has_bulk_import: bool = Field(default=False)
    has_marketing_codes: bool = Field(default=False)
    has_staff_accounts: bool = Field(default=False)
    max_staff_accounts: Optional[int] = None
    has_email_support: bool = Field(default=False)
    has_priority_support: bool = Field(default=False)

    # Trial
    trial_days: int = Field(default=0)

    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SellerSubscription(SQLModel, table=True):
    """Tracks active subscription for each seller/shop."""
    __tablename__ = "seller_subscription"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)
    plan_id: int = Field(foreign_key="subscription_plan.id", index=True)
    billing_frequency: BillingFrequency = Field(default=BillingFrequency.MONTHLY)

    # Trial tracking
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    is_trial_active: bool = Field(default=False, index=True)

    # Subscription period
    started_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    current_period_start: datetime = Field(default_factory=datetime.utcnow)
    current_period_end: datetime  # calculated on creation
    renews_at: Optional[datetime] = None

    # Status
    status: BillingStatus = Field(default=BillingStatus.ACTIVE, index=True)
    is_active: bool = Field(default=True, index=True)

    # Cancellation
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SellerBilling(SQLModel, table=True):
    """Tracks M-Pesa payment transactions for subscriptions."""
    __tablename__ = "seller_billing"

    id: Optional[int] = Field(default=None, primary_key=True)
    subscription_id: int = Field(foreign_key="seller_subscription.id", index=True)
    seller_id: int = Field(foreign_key="user.id", index=True)

    # Payment details
    amount_kes: float
    phone_number: str = Field(index=True)  # M-Pesa phone
    mpesa_request_id: Optional[str] = Field(default=None, unique=True, index=True)
    mpesa_checkout_request_id: Optional[str] = Field(default=None, unique=True, index=True)

    # Payment status
    status: str = Field(default="pending", index=True)  # pending, success, failed, timeout

    # M-Pesa response
    mpesa_response: Optional[dict] = Field(default=None, sa_column=Column(JSON))

    # Invoice
    invoice_number: Optional[str] = Field(default=None, unique=True, index=True)

    # Dates
    payment_date: Optional[datetime] = None
    due_date: datetime  # when payment is due
    next_billing_date: Optional[datetime] = None

    # Retry tracking
    retry_count: int = Field(default=0)
    last_retry_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SellerFeatureAccess(SQLModel, table=True):
    """Maps which features are available to each seller based on their plan."""
    __tablename__ = "seller_feature_access"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True, unique=True)
    subscription_id: int = Field(foreign_key="seller_subscription.id", index=True)

    # Feature flags (cached from plan, updated when subscription changes)
    has_analytics: bool = Field(default=False)
    has_verified_badge: bool = Field(default=False)
    has_priority_ranking: bool = Field(default=False)
    has_custom_branding: bool = Field(default=False)
    has_bulk_import: bool = Field(default=False)
    has_marketing_codes: bool = Field(default=False)
    has_staff_accounts: bool = Field(default=False)
    has_email_support: bool = Field(default=False)
    has_priority_support: bool = Field(default=False)

    # Limits
    max_products: Optional[int] = None
    max_staff_accounts: Optional[int] = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FeaturedSelling(SQLModel, table=True):
    """Featured advertising placements (campaigns with analytics)."""
    __tablename__ = "featured_selling"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id", index=True)

    # Placement type: homepage_featured_shop, sponsored_product, category_featured_shop,
    # search_sponsored, top_of_category, featured_banner, new_arrival, flash_sale, market_promotion, recommended_shops
    placement_type: str = Field(index=True)

    # Campaign metadata
    campaign_name: Optional[str] = None
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    market_id: Optional[int] = None  # For market-level promotions (e.g., Eastleigh)

    # Duration
    starts_at: datetime = Field(index=True)
    ends_at: datetime = Field(index=True)

    # Payment
    price_kes: float
    is_paid: bool = Field(default=False, index=True)
    billing_id: Optional[int] = Field(default=None, foreign_key="seller_billing.id")

    # Status
    is_active: bool = Field(default=True, index=True)

    # Analytics - track campaign performance
    views: int = Field(default=0)           # Times featured placement was shown
    shop_visits: int = Field(default=0)     # Clicks to shop
    product_clicks: int = Field(default=0)  # Product interaction clicks
    whatsapp_clicks: int = Field(default=0) # WhatsApp contact clicks
    call_clicks: int = Field(default=0)     # Phone call clicks
    message_clicks: int = Field(default=0)  # In-app message clicks
    followers_gained: int = Field(default=0) # New followers during campaign
    conversions: int = Field(default=0)     # Sales attributed to this placement (optional)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
