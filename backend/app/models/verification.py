from datetime import datetime
from typing import Optional, List, Any, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship
from pydantic import field_validator
from enum import Enum
from sqlalchemy import Column, JSON
from app.models.common import OwnerRead
if TYPE_CHECKING:
    from app.models.user import User

class VerificationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class VerificationRequestBase(SQLModel):
    document_type: str  # ID, Passport, Business Registration
    id_number: Optional[str] = None
    status: VerificationStatus = Field(default=VerificationStatus.PENDING)
    tier: str = Field(default="tier2") # tier2, tier3
    notes: Optional[str] = None
    document_urls: List[str] = Field(default=[], sa_column=Column(JSON))
    selfie_url: Optional[str] = None
    proof_of_address_url: Optional[str] = None
    video_selfie_url: Optional[str] = None
    facial_match_score: Optional[float] = None
    auto_verification_status: Optional[str] = None  # passed, failed, manual_review
    
    @field_validator("document_urls", mode="before")
    @classmethod
    def flatten_urls(cls, v: Any) -> Any:
        if isinstance(v, list):
            new_list = []
            for item in v:
                if isinstance(item, (list, tuple)) and len(item) > 0:
                    new_list.append(item[0])
                elif isinstance(item, str):
                    # Check if the string itself is a tuple representation
                    val_str = item.strip()
                    if val_str.startswith("(") and val_str.endswith(")"):
                        inner = val_str[1:-1]
                        parts = inner.split(",", 1)
                        if parts:
                            new_list.append(parts[0].strip().strip("'").strip('"'))
                        else:
                            new_list.append(item)
                    else:
                        new_list.append(item)
            return new_list
        return v

    @field_validator("selfie_url", "proof_of_address_url", "video_selfie_url", mode="before")
    @classmethod
    def clean_tuple_string(cls, v: Any) -> Optional[str]:
        if not v:
            return None
        v_str = str(v).strip()
        if v_str.startswith("(") and v_str.endswith(")"):
            inner = v_str[1:-1]
            parts = inner.split(",", 1)
            if parts:
                return parts[0].strip().strip("'").strip('"')
        return v_str

class VerificationRequest(VerificationRequestBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="verification_requests")


class VerificationRequestRead(VerificationRequestBase):
    id: int
    user_id: int
    created_at: datetime
    user: Optional[OwnerRead] = None
