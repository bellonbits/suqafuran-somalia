from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON, Index


class OTPLog(SQLModel, table=True):
    """
    Append-only event log for every OTP lifecycle event.
    Records are never deleted or updated — new events are always inserted.
    """
    __tablename__ = "otp_log"
    __table_args__ = (
        Index("ix_otp_log_identifier_created", "identifier", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    # Who the OTP was for
    identifier: str = Field(index=True)         # normalised phone or email
    channel: str = Field(index=True)            # "sms" | "email" | "whatsapp"

    # What happened
    event_type: str = Field(index=True)
    # "sent" | "resent" | "verified" | "failed" | "expired" | "attempt_failed"

    status: str                                 # "success" | "failed" | "pending"

    # Idempotency — prevents double-logging the same atomic action
    idempotency_key: Optional[str] = Field(default=None, index=True, unique=True)

    attempt_count: int = Field(default=0)
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Optional extra context (provider response, error message, …)
    meta: Optional[dict] = Field(default=None, sa_column=Column(JSON))
