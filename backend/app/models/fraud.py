import enum
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import Field, SQLModel, JSON

class FraudTargetType(str, enum.Enum):
    USER = "user"
    LISTING = "listing"
    MESSAGE = "message"
    DEVICE = "device"

class FraudEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    target_type: FraudTargetType
    target_id: str # ID of the user, listing, etc.
    rule_name: str # The name of the fraud detection rule triggered
    risk_score: int # 0-100 score for this specific event
    confidence: float # 0.0-1.0 confidence in the detection
    event_data: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON) # Raw signals that triggered the rule
    status: str = Field(default="pending") # pending, investigated, dismissed, actioned
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RiskHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    previous_score: int
    new_score: int
    reason: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
