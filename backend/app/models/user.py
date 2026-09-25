import enum
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.verification import VerificationRequest
    from app.models.wallet import Wallet
    from app.models.order import Order
    from app.models.cart import Cart


class UserVerifiedLevel(str, enum.Enum):
    guest = "guest"
    phone = "phone" # Legacy
    id = "id"       # Legacy
    tier1 = "tier1" # Minimal (Phone/Email)
    tier2 = "tier2" # Standard (ID/Address/Liveness)
    tier3 = "tier3" # Enhanced (Video/Bank)
    premium = "premium" # Gold Badge
    trusted = "trusted"


class TrustLevel(str, enum.Enum):
    NEW = "NEW"        # Bronze
    ESTABLISHED = "ESTABLISHED" # Silver
    VERIFIED = "VERIFIED"    # Gold
    TRUSTED = "TRUSTED"     # Platinum


# Verification tier hierarchy (must be in ascending order of trust)
TIER_HIERARCHY = [
    "guest",
    "phone",
    "id",
    "tier1",
    "tier2",
    "tier3",
    "premium",
    "trusted",
]


class UserBase(SQLModel):
    full_name: Optional[str] = None
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = Field(default=None, unique=True, index=True)
    is_active: bool = True
    is_verified: bool = False
    email_verified: bool = Field(default=False)
    phone_verified: bool = Field(default=False)  # kept for legacy
    is_admin: bool = False
    verified_level: UserVerifiedLevel = Field(default=UserVerifiedLevel.guest)
    avatar_url: Optional[str] = None
    response_time: Optional[str] = "Typically responds in a few hours"
    email_notifications: bool = True
    sms_notifications: bool = False
    is_agent: bool = Field(default=False)
    profile_views: int = Field(default=0)
    referral_code: Optional[str] = Field(default=None, index=True)       # marketing promo code used at signup
    referral_listing_counted: bool = Field(default=False)                 # True after first ad posted
    location: Optional[str] = Field(default=None)                        # city / region set from profile
    market: Optional[str] = Field(default="Eastleigh Market", index=True) # Kenyan market location (defaults to Eastleigh Market)
    device_fingerprint: Optional[str] = Field(default=None, index=True)
    last_ip: Optional[str] = Field(default=None)
    fcm_token: Optional[str] = Field(default=None)  # Firebase push notification token
    
    # Trust & Security Fields
    trust_score: int = Field(default=0)
    trust_level: TrustLevel = Field(default=TrustLevel.NEW)
    is_flagged: bool = Field(default=False)
    is_suspended: bool = Field(default=False)

    # Shop/Business Fields
    business_name: Optional[str] = Field(default=None)  # Business/shop name
    shop_description: Optional[str] = Field(default=None)  # Shop description
    shop_page_banner: Optional[str] = Field(default=None)  # Banner for shops listing page
    shop_detail_banner: Optional[str] = Field(default=None)  # Banner for shop detail page
    logo_url: Optional[str] = Field(default=None)  # Shop logo for card display
    is_featured: bool = Field(default=False)  # Featured shop status
    free_delivery: bool = Field(default=False)  # Free delivery badge
    primary_category_id: Optional[int] = Field(default=None, foreign_key="category.id", index=True)  # Primary category based on listing count


class User(UserBase, table=True, tablename="user"):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: Optional[str] = Field(default=None)  # Keep optional for backward compat/admin
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def has_verification_level(self, required_level: UserVerifiedLevel) -> bool:
        """Check if user has at least the required verification level."""
        try:
            required_index = TIER_HIERARCHY.index(required_level.value)
            current_index = TIER_HIERARCHY.index(self.verified_level.value)
            return current_index >= required_index
        except ValueError:
            return False

    listings: List["Listing"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={"foreign_keys": "Listing.owner_id"}
    )
    verification_requests: List["VerificationRequest"] = Relationship(back_populates="user")
    wallet: Optional["Wallet"] = Relationship(back_populates="user")

    # Order relationships
    orders_as_customer: List["Order"] = Relationship(
        back_populates="customer",
        sa_relationship_kwargs={"foreign_keys": "Order.customer_id"}
    )
    orders_as_seller: List["Order"] = Relationship(
        back_populates="seller",
        sa_relationship_kwargs={"foreign_keys": "Order.seller_id"}
    )
    orders_as_rider: List["Order"] = Relationship(
        back_populates="rider",
        sa_relationship_kwargs={"foreign_keys": "Order.rider_id"}
    )

    # Cart relationship
    cart: Optional["Cart"] = Relationship(back_populates="user")


class UserCreate(SQLModel):
    phone: str
    full_name: Optional[str] = None


class UserUpdate(SQLModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    response_time: Optional[str] = None
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    location: Optional[str] = None
    business_name: Optional[str] = None
    shop_description: Optional[str] = None
    shop_page_banner: Optional[str] = None
    shop_detail_banner: Optional[str] = None
    is_featured: Optional[bool] = None
    free_delivery: Optional[bool] = None
    is_verified: Optional[bool] = None


class PasswordChange(SQLModel):
    current_password: str
    new_password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

