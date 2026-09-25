"""Per-user send history for the promotional campaign rotation engine."""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CampaignSendLog(SQLModel, table=True):
    """One row per campaign email actually sent to a user. Used to enforce
    per-campaign cooldowns, weekly promotional frequency caps, and to avoid
    repeating the same category/shop/subject-variant too soon for a given
    user (see app/services/rotation_engine.py)."""
    __tablename__ = "campaign_send_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    campaign_type: str = Field(index=True)
    subject_variant: str
    category_id: Optional[int] = Field(default=None, foreign_key="category.id", index=True)
    listing_ids: Optional[str] = None  # JSON list
    shop_ids: Optional[str] = None  # JSON list
    template_event_type: Optional[str] = None
    email_log_id: Optional[int] = Field(default=None, foreign_key="emaillog.id")
    sent_at: datetime = Field(default_factory=datetime.utcnow, index=True)
