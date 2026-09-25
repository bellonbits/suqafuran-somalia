from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class UserSession(SQLModel, table=True):
    """
    One row per signed-in device. Login tokens carry this row's id ("sid"), so
    a session stays valid until the user logs out (or changes/resets their
    password) instead of until a fixed expiry -- and a leaked token can be
    killed by revoking its session.
    """
    __tablename__ = "user_session"

    id: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = None
    user_agent: Optional[str] = None
    ip: Optional[str] = None
