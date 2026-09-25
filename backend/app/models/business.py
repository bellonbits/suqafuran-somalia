import enum
import uuid as uuid_pkg
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, JSON

class BusinessRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    SALES_AGENT = "sales_agent"
    SUPPORT_AGENT = "support_agent"
    INVENTORY_STAFF = "inventory_staff"
    DELIVERY_STAFF = "delivery_staff"

class Business(SQLModel, table=True):
    id: Optional[uuid_pkg.UUID] = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False
    )
    owner_id: int = Field(foreign_key="user.id", index=True)
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = None
    category: str = Field(index=True)  # e.g., "shop", "service", "restaurant", "freelancer"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    is_verified: bool = Field(default=False)
    show_in_nearby: bool = Field(default=False, index=True)
    is_approved: bool = Field(default=False, index=True)
    opening_hours: Optional[dict] = Field(default={}, sa_column=Column(JSON))
    is_active: bool = Field(default=True, index=True)
    rating: float = Field(default=0.0)
    trust_score: int = Field(default=0)
    brand_color: Optional[str] = Field(default="#2563eb")
    tagline: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Employee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    invite_email: Optional[str] = Field(default=None, index=True)
    invite_phone: Optional[str] = Field(default=None, index=True)
    role: BusinessRole = Field(default=BusinessRole.SALES_AGENT)
    is_active: bool = Field(default=True, index=True)
    performance_sales: float = Field(default=0.0)
    performance_responses: int = Field(default=0)
    performance_orders_handled: int = Field(default=0)
    joined_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessProduct(SQLModel, table=True):
    __tablename__ = "businessproduct"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    listing_id: Optional[int] = Field(default=None, foreign_key="listing.id", index=True)
    name_en: str = Field(index=True)
    name_so: Optional[str] = Field(default=None, index=True)
    description_en: Optional[str] = None
    description_so: Optional[str] = None
    sku: Optional[str] = Field(default=None, index=True)
    price: float
    discount_price: Optional[float] = None
    stock_level: int = Field(default=0)
    low_stock_threshold: int = Field(default=5)
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    subcategory_id: Optional[int] = Field(default=None, foreign_key="subcategory.id")
    images: List[str] = Field(default=[], sa_column=Column(JSON))
    variants: Optional[dict] = Field(default={}, sa_column=Column(JSON))  # e.g., sizes, colors
    is_active: bool = Field(default=True, index=True)
    views: int = Field(default=0)
    clicks: int = Field(default=0)
    sales: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessCustomer(SQLModel, table=True):
    __tablename__ = "businesscustomer"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    notes: Optional[str] = None
    total_orders: int = Field(default=0)
    total_spent: float = Field(default=0.0)
    loyalty_score: int = Field(default=0)
    segmentation: str = Field(default="new")  # e.g., new, regular, VIP, inactive
    last_purchase_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessOrder(SQLModel, table=True):
    __tablename__ = "businessorder"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    customer_id: int = Field(foreign_key="user.id", index=True)
    employee_id: Optional[int] = Field(default=None, foreign_key="employee.id", index=True)
    status: str = Field(default="pending", index=True)  # pending, processing, completed, cancelled, refunded
    total_amount: float
    payment_status: str = Field(default="pending")  # pending, paid, failed, refunded
    payment_method: Optional[str] = None  # e.g., mobile_money, wallet, cash
    items: List[dict] = Field(default=[], sa_column=Column(JSON))  # list of {product_id, name, qty, price}
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessMessage(SQLModel, table=True):
    __tablename__ = "businessmessage"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    customer_id: int = Field(foreign_key="user.id", index=True)
    sender_id: int = Field(foreign_key="user.id")
    content: str
    is_from_customer: bool = Field(default=True)
    is_read: bool = Field(default=False)
    tags: List[str] = Field(default=[], sa_column=Column(JSON))  # e.g. ["billing", "support"]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TeamMessage(SQLModel, table=True):
    __tablename__ = "teammessage"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    sender_id: int = Field(foreign_key="user.id", index=True)
    content: str
    is_announcement: bool = Field(default=False)
    order_id: Optional[int] = Field(default=None, foreign_key="order.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessTask(SQLModel, table=True):
    __tablename__ = "businesstask"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: uuid_pkg.UUID = Field(foreign_key="business.id", index=True)
    title: str = Field(index=True)
    description: Optional[str] = None
    status: str = Field(default="todo", index=True)  # todo, in_progress, review, done
    assigned_to: Optional[int] = Field(default=None, foreign_key="employee.id", index=True)
    order_id: Optional[int] = Field(default=None, foreign_key="order.id", index=True)
    due_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
