from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class MarketingCode(SQLModel, table=True):
    __tablename__ = "marketing_codes"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True, max_length=50)
    description: str = Field(default="")
    created_by: str = Field(default="")       # marketing team member name/email
    max_uses: Optional[int] = Field(default=None)  # None = unlimited
    uses_count: int = Field(default=0)         # users who signed up with this code
    ads_posted_count: int = Field(default=0)   # of those, how many posted ≥1 ad
    is_active: bool = Field(default=True)
    expires_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
