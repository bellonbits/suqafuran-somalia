"""Featured Listing (Ad) payment and management model."""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship


class FeaturedListingBase(SQLModel):
    listing_id: int = Field(foreign_key="listing.id", index=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    boost_level: str = Field(index=True)  # "basic", "vip", "diamond"
    amount_paid: float
    currency: str = Field(default="KES")
    duration_days: int  # How many days to feature
    status: str = Field(default="pending", index=True)  # pending, active, expired, cancelled
    payment_status: str = Field(default="pending", index=True)  # pending, processing, success, failed
    payment_method: str  # mpesa, stripe, paypal, etc.
    payment_reference: Optional[str] = Field(default=None)  # Transaction ID from payment provider


class FeaturedListing(FeaturedListingBase, table=True):
    __tablename__ = "featured_listing"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    activated_at: Optional[datetime] = Field(default=None)
    expires_at: Optional[datetime] = Field(default=None)
    cancelled_at: Optional[datetime] = Field(default=None)

    # Tracking
    impressions: int = Field(default=0)  # How many times featured listing was shown
    clicks: int = Field(default=0)  # How many times it was clicked


class FeaturedListingRead(FeaturedListingBase):
    id: int
    created_at: datetime
    updated_at: datetime
    activated_at: Optional[datetime]
    expires_at: Optional[datetime]
