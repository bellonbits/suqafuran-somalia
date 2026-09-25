"""Analytics models for tracking user sessions, activities, and conversions."""

from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional
from uuid import uuid4


class UserSession(SQLModel, table=True):
    """Track active user sessions."""

    __tablename__ = "user_session"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    session_token: str = Field(unique=True, index=True)

    # Session tracking
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None  # mobile, tablet, desktop

    # Timing
    started_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    last_activity_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    ended_at: Optional[datetime] = None

    # Pages visited
    current_page: Optional[str] = None
    page_history: str = ""  # JSON array of visited pages

    # Engagement
    total_clicks: int = 0
    total_interactions: int = 0

    # Status
    is_active: bool = True


class UserActivity(SQLModel, table=True):
    """Log user actions and interactions."""

    __tablename__ = "user_activity"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = Field(foreign_key="user_session.id", index=True)

    # Action details
    action_type: str = Field(index=True)  # view_listing, add_to_cart, search, login, signup, purchase, etc.
    action_category: str = Field(index=True)  # user, shop, listing, order, etc.
    resource_id: Optional[str] = None  # listing_id, shop_id, order_id, etc.
    resource_type: Optional[str] = None

    # Context
    page_url: Optional[str] = None
    referrer: Optional[str] = None
    search_query: Optional[str] = None

    # Metadata
    event_metadata: str = ""  # JSON for additional data

    # Timing & Location
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    ip_address: Optional[str] = None



class ConversionFunnel(SQLModel, table=True):
    """Track user conversion funnel stages."""

    __tablename__ = "conversion_funnel"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = Field(foreign_key="user_session.id", index=True)

    # Funnel stages (timestamp when each stage was reached)
    signup_at: Optional[datetime] = None
    first_search_at: Optional[datetime] = None
    first_view_listing_at: Optional[datetime] = None
    first_add_to_cart_at: Optional[datetime] = None
    first_purchase_at: Optional[datetime] = None
    repeat_purchase_at: Optional[datetime] = None

    # Status
    current_stage: str = Field(default="signup")  # signup, search, view, cart, purchase, repeat
    completed: bool = False

    # Tracking
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ItemView(SQLModel, table=True):
    """Track item/listing views for engagement analytics."""

    __tablename__ = "item_view"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    listing_id: int = Field(foreign_key="listing.id", index=True)
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = None

    # Device & Location
    device_type: Optional[str] = None  # mobile, tablet, desktop
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    # Engagement duration
    time_spent_seconds: int = 0

    # Referrer
    referrer: Optional[str] = None

    # Timestamp
    viewed_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ShopView(SQLModel, table=True):
    """Track shop profile views for engagement analytics."""

    __tablename__ = "shop_view"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    shop_owner_id: int = Field(foreign_key="user.id", index=True)
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = None

    # Device & Location
    device_type: Optional[str] = None  # mobile, tablet, desktop
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    # Engagement duration
    time_spent_seconds: int = 0

    # Referrer
    referrer: Optional[str] = None

    # Timestamp
    viewed_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class SearchEvent(SQLModel, table=True):
    """Track search queries for marketplace analytics."""

    __tablename__ = "search_event"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    query: str = Field(index=True)
    result_count: int = 0
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = None

    # Device & Location
    device_type: Optional[str] = None
    ip_address: Optional[str] = None
    category_filter: Optional[str] = None
    location_filter: Optional[str] = None

    # Timestamp
    searched_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ClickEvent(SQLModel, table=True):
    """Track user actions (chat, call, favorite, etc.) for conversion analytics."""

    __tablename__ = "click_event"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    event_type: str = Field(index=True)  # "chat", "whatsapp", "call", "favorite", "share", "review"
    listing_id: Optional[int] = Field(foreign_key="listing.id", index=True)
    shop_id: Optional[int] = Field(foreign_key="user.id", index=True)
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = None

    # Device info
    device_type: Optional[str] = None
    ip_address: Optional[str] = None

    # Timestamp
    clicked_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ConversionFunnelEvent(SQLModel, table=True):
    """Track conversion funnel: View -> Click -> Contact -> Transaction."""

    __tablename__ = "conversion_funnel_event"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = None

    # Funnel stages
    stage: str = Field(index=True)  # "view", "click", "chat", "contact", "transaction"
    listing_id: Optional[int] = Field(index=True)
    shop_id: Optional[int] = Field(index=True)

    # Metadata
    device_type: Optional[str] = None
    ip_address: Optional[str] = None

    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class GeographicEvent(SQLModel, table=True):
    """Track user location/city for geographic analytics."""

    __tablename__ = "geographic_event"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    city: Optional[str] = Field(index=True)
    country: Optional[str] = Field(index=True)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    user_id: Optional[int] = Field(foreign_key="user.id", index=True)
    session_id: Optional[str] = None

    # Event context
    event_type: str = Field(index=True)  # "view", "search", "click", "chat"
    listing_id: Optional[int] = Field(index=True)
    shop_id: Optional[int] = Field(index=True)

    # Device
    device_type: Optional[str] = None
    ip_address: Optional[str] = None

    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class UserCohort(SQLModel, table=True):
    """Track user cohorts: new, returning, verified sellers."""

    __tablename__ = "user_cohort"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    # Cohort info
    first_visit_at: datetime = Field(index=True)
    last_visit_at: datetime
    visit_count: int = 0
    is_seller: bool = False
    is_verified: bool = False

    # Activity
    total_searches: int = 0
    total_clicks: int = 0
    total_chats: int = 0

    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DeviceMetric(SQLModel, table=True):
    """Track device type distribution for analytics."""

    __tablename__ = "device_metric"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    device_type: str = Field(index=True)  # "mobile", "tablet", "desktop"
    event_type: str = Field(index=True)  # "view", "search", "click"
    count: int = 0

    # Timestamp (bucket by hour/day)
    date: datetime = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AdminAlert(SQLModel, table=True):
    """Alert rules and thresholds for admin monitoring."""

    __tablename__ = "admin_alert"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    alert_type: str = Field(index=True)  # "traffic_spike", "low_engagement", "new_seller", "suspicious_activity"
    metric: str  # "views", "chats", "conversions", "seller_count"
    threshold: float
    comparison: str  # ">", "<", "==", "spike"
    enabled: bool = True

    # Notification settings
    notify_admin: bool = True
    notify_seller: bool = False

    # Metadata
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AlertEvent(SQLModel, table=True):
    """Log of triggered alerts."""

    __tablename__ = "alert_event"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    alert_id: str = Field(foreign_key="admin_alert.id", index=True)
    alert_type: str = Field(index=True)

    # Event details
    metric_value: float
    threshold: float
    entity_type: Optional[str] = None  # "shop", "listing", "user"
    entity_id: Optional[int] = None

    # Status
    status: str = Field(default="triggered")  # "triggered", "acknowledged", "resolved"
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    # Metadata
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
