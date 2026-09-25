from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import secrets


class EmailLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    email: str = Field(index=True)
    email_type: str = Field(index=True) # onboarding_welcome, activity_price_drop, safety_otp, etc.
    subject: str
    status: str = Field(default="queued") # queued, sent, failed, opened, clicked, bounced, unsubscribed
    tracking_token: str = Field(default_factory=lambda: secrets.token_urlsafe(16), unique=True, index=True)
    sent_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    failed_reason: Optional[str] = None
    provider_used: Optional[str] = None
    campaign_id: Optional[str] = None
    metadata_json: Optional[str] = None
