"""Marketing automation models for email campaigns and user engagement."""

from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, Enum as SQLEnum
import enum


class EmailEventType(str, enum.Enum):
    """Triggers for sending emails."""
    SIGNUP = "signup"
    SHOP_CREATED = "shop_created"
    LISTING_APPROVED = "listing_approved"
    LISTING_REJECTED = "listing_rejected"
    LISTING_VIEWS_MILESTONE = "listing_views_milestone"  # 10, 50, 100, 500 views
    LISTING_SAVED = "listing_saved"
    PRICE_DROPPED = "price_dropped"
    ABANDONED_LISTING = "abandoned_listing"  # Draft not completed
    INACTIVE_SELLER = "inactive_seller"  # No login for 14 days
    BUYER_INTERESTED = "buyer_interested"  # Viewed many products
    VIEWED_LISTING_NO_CONTACT = "viewed_listing_no_contact"  # Viewed a listing, never messaged the seller
    SAVED_SEARCH_MATCH = "saved_search_match"  # New listings match saved search
    MESSAGE_RECEIVED = "message_received"
    OFFER_ACCEPTED = "offer_accepted"
    LISTING_EXPIRING_SOON = "listing_expiring_soon"  # 3 days before expiration
    VERIFICATION_CAMPAIGN = "verification_campaign"
    WEEKLY_DIGEST = "weekly_digest"
    BIRTHDAY = "birthday"
    SEASONAL_CAMPAIGN = "seasonal_campaign"
    REENGAGEMENT = "reengagement"


class UserBrowsingHistory(SQLModel, table=True):
    """Track user browsing for personalized emails."""
    __tablename__ = "user_browsing_history"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    listing_id: Optional[int] = Field(foreign_key="listing.id")
    category_id: Optional[int] = Field(foreign_key="category.id")
    shop_id: Optional[int] = Field(foreign_key="user.id")  # Shop owner
    viewed_at: datetime = Field(default_factory=datetime.utcnow)
    time_spent_seconds: int = 0  # How long they looked at it


class SavedSearch(SQLModel, table=True):
    """Track user's saved searches for email triggers."""
    __tablename__ = "saved_searches"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    search_query: str  # e.g., "iPhone"
    category_id: Optional[int] = Field(foreign_key="category.id")
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_email_sent: Optional[datetime] = None


class ListingPerformance(SQLModel, table=True):
    """Track listing performance for seller emails."""
    __tablename__ = "listing_performance"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listing.id")
    views: int = 0
    saves: int = 0
    chats: int = 0
    phone_clicks: int = 0
    week_starting: datetime  # For weekly digest
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmailCampaign(SQLModel, table=True):
    """Track sent emails for engagement metrics."""
    __tablename__ = "email_campaigns"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    event_type: EmailEventType = Field(sa_column=SQLEnum(EmailEventType))
    subject: str
    template_name: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    clicked_link: Optional[str] = None
    status: str = "sent"  # sent, opened, clicked, bounced, unsubscribed
    
    # Context data
    listing_id: Optional[int] = None
    shop_id: Optional[int] = None
    related_user_id: Optional[int] = None  # For sale/message events


class EmailPreference(SQLModel, table=True):
    """User email preferences."""
    __tablename__ = "email_preferences"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    
    # Notification preferences
    new_messages: bool = True
    listing_updates: bool = True
    price_drops: bool = True
    saved_search_matches: bool = True
    marketplace_digest: bool = True
    promotional_emails: bool = True
    seller_tips: bool = True
    verification_campaigns: bool = True
    seasonal_campaigns: bool = True
    
    # Frequency
    digest_frequency: str = "weekly"  # daily, weekly, monthly
    quiet_hours_start: Optional[str] = None  # "20:00"
    quiet_hours_end: Optional[str] = None    # "08:00"
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserLifecycleStage(SQLModel, table=True):
    """Track user's lifecycle stage for targeted campaigns."""
    __tablename__ = "user_lifecycle_stage"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    
    stage: str  # signup, profile_complete, first_listing, active_seller, active_buyer, inactive
    days_since_signup: int = 0
    listings_count: int = 0
    purchases_count: int = 0
    last_activity: Optional[datetime] = None
    
    # For reengagement campaigns
    reengagement_email_sent: bool = False
    reengagement_email_date: Optional[datetime] = None
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)
