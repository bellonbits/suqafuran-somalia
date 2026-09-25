from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    action: str # e.g., "MATCH_PAYMENT", "ACTIVATE_PROMOTION"
    resource_type: str # e.g., "promotion"
    resource_id: int
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
