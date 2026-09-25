"""Admin broadcast campaigns that drip out over multiple days to stay under
a daily sending-provider quota, instead of firing every recipient at once."""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class BroadcastJob(SQLModel, table=True):
    __tablename__ = "broadcast_job"

    id: Optional[int] = Field(default=None, primary_key=True)
    subject: str
    title: str
    subtitle: Optional[str] = None
    content_html: str
    action_text: Optional[str] = None
    action_url: Optional[str] = None
    campaign_id: Optional[str] = None
    daily_limit: int = Field(default=250)
    status: str = Field(default="in_progress", index=True)  # in_progress, completed, cancelled
    total_recipients: int = 0
    sent_count: int = 0
    failed_count: int = 0
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BroadcastJobRecipient(SQLModel, table=True):
    __tablename__ = "broadcast_job_recipient"

    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="broadcast_job.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    email: str
    status: str = Field(default="pending", index=True)  # pending, sent, failed
    sent_at: Optional[datetime] = Field(default=None, index=True)
    failed_reason: Optional[str] = None
