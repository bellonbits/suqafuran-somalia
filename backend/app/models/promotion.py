import enum
from datetime import datetime
from typing import Optional
import sqlalchemy as sa
from sqlmodel import Field, SQLModel, Column

class PromotionStatus(str, enum.Enum):
    WAITING_FOR_PAYMENT = "waiting_for_payment"
    PENDING = "pending" # Payment matched by agent
    PAID = "paid" # Promotion activated
    SUBMITTED = "submitted" # Legacy/Manual proof
    APPROVED = "approved" # Legacy
    REJECTED = "rejected"
    EXPIRED = "expired"

class PromotionCodeStatus(str, enum.Enum):
    GENERATED = "generated"
    APPLIED = "applied"
    CANCELLED = "cancelled"

class PromotionPlan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name_en: str # e.g., "Basic Boost"
    name_so: Optional[str] = None
    price_usd: float
    duration_days: int
    description_en: Optional[str] = None
    description_so: Optional[str] = None

class Promotion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listing.id")
    plan_id: int = Field(foreign_key="promotionplan.id")
    status: PromotionStatus = Field(
        default=PromotionStatus.WAITING_FOR_PAYMENT,
        sa_column=Column(
            sa.Enum(PromotionStatus, values_callable=lambda x: [e.value for e in x]),
            nullable=False
        )
    )
    payment_phone: Optional[str] = None # The phone number used for payment detection
    amount: float = Field(default=0.0) # Expected amount
    payment_proof: Optional[str] = None # Transaction ID or screenshot URL (Manual fallback)
    admin_notes: Optional[str] = None
    promotion_code: Optional[str] = Field(default=None, unique=True, index=True)
    approved_by: Optional[int] = Field(default=None, foreign_key="user.id")
    approved_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None)
    lipana_tx_id: Optional[str] = Field(default=None, index=True)  # Lipana transaction ID


class PromotionCode(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    status: PromotionCodeStatus = Field(default=PromotionCodeStatus.GENERATED)
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id")
    plan_id: Optional[int] = Field(default=None, foreign_key="promotionplan.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used_at: Optional[datetime] = Field(default=None)
