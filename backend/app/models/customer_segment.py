"""Customer segment models for targeted campaigns."""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CustomerSegmentBase(SQLModel):
    """Base customer segment model."""
    name: str
    description: Optional[str] = None
    criteria: str  # JSON rules for segment
    is_active: bool = Field(default=True)


class CustomerSegment(CustomerSegmentBase, table=True):
    """Customer segment stored in database."""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    member_count: int = Field(default=0)  # Cache of matching users


class CustomerSegmentCreate(CustomerSegmentBase):
    """Create customer segment request."""
    pass


class CustomerSegmentUpdate(SQLModel):
    """Update customer segment request."""
    name: Optional[str] = None
    description: Optional[str] = None
    criteria: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerSegmentRead(CustomerSegmentBase):
    """Customer segment response."""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    member_count: int


class SegmentCriteria(SQLModel):
    """Segment criteria definition."""
    field: str  # is_seller, verified_level, active_listings_count, etc.
    operator: str  # equals, contains, greater_than, less_than, in, not_in
    value: str | list  # Value to match


class SegmentCampaignRequest(SQLModel):
    """Request to send campaign to segment."""
    segment_id: int
    message: str
    message_type: str = "general"
    dry_run: bool = False
