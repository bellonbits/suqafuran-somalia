import enum
from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, JSON

if __name__ != "__main__":
    from typing import TYPE_CHECKING
    if TYPE_CHECKING:
        from app.models.user import User
        from app.models.business import Business
        from app.models.listing import Listing
        from app.models.delivery import Delivery


class OrderStatus(str, enum.Enum):
    pending = "pending"                    # Awaiting seller confirmation
    confirmed = "confirmed"                # Seller confirmed
    packed = "packed"                      # Ready to ship/pickup
    ready_for_pickup = "ready_for_pickup"  # For pickup mode
    in_transit = "in_transit"              # Rider picked up (delivery mode)
    delivered = "delivered"                # Order delivered
    completed = "completed"                # Customer received
    cancelled = "cancelled"                # Order cancelled
    refund_requested = "refund_requested"  # Refund initiated
    refunded = "refunded"                  # Refund completed


class FulfillmentType(str, enum.Enum):
    delivery = "delivery"  # Rider delivers to customer
    pickup = "pickup"      # Customer picks up from shop


class OrderBase(SQLModel):
    customer_id: int = Field(foreign_key="user.id", index=True)
    seller_id: int = Field(foreign_key="user.id", index=True)
    business_id: Optional[str] = Field(default=None, foreign_key="business.id", index=True)  # UUID as string

    # Fulfillment
    fulfillment_type: FulfillmentType = Field(default=FulfillmentType.delivery, index=True)
    address_id: Optional[int] = Field(default=None, foreign_key="savedaddress.id")
    delivery_notes: Optional[str] = None
    pickup_notes: Optional[str] = None

    # Status & Tracking
    status: OrderStatus = Field(default=OrderStatus.pending, index=True)
    rider_id: Optional[int] = Field(default=None, foreign_key="user.id")
    delivery_id: Optional[int] = Field(default=None, foreign_key="delivery.id")

    # Pricing
    subtotal: float = Field(gt=0)  # Sum of all items
    service_fee: float = Field(default=0, ge=0)  # Platform fee (percentage-based)
    delivery_fee: float = Field(default=0, ge=0)  # Delivery charge (0 for pickup)
    courier_tip: float = Field(default=0, ge=0)  # Optional tip for rider
    discount_amount: float = Field(default=0, ge=0)  # Promo code discount
    tax_amount: float = Field(default=0, ge=0)  # Tax
    total_amount: float = Field(gt=0)  # Final amount to pay

    # Customer Info
    customer_phone: str  # For rider contact

    # Metadata
    notes: Optional[str] = None  # Customer special instructions
    admin_notes: Optional[str] = None  # Internal notes
    extra_info: dict = Field(default={}, sa_column=Column(JSON))  # For flexibility

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    confirmed_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


class Order(OrderBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Relationships
    customer: Optional["User"] = Relationship(
        back_populates="orders_as_customer",
        sa_relationship_kwargs={"foreign_keys": "Order.customer_id"}
    )
    seller: Optional["User"] = Relationship(
        back_populates="orders_as_seller",
        sa_relationship_kwargs={"foreign_keys": "Order.seller_id"}
    )
    rider: Optional["User"] = Relationship(
        back_populates="orders_as_rider",
        sa_relationship_kwargs={"foreign_keys": "Order.rider_id"}
    )
    items: List["OrderItem"] = Relationship(
        back_populates="order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    delivery: Optional["Delivery"] = Relationship(back_populates="order")


class OrderItemBase(SQLModel):
    order_id: int = Field(foreign_key="order.id", index=True)
    product_id: int = Field(foreign_key="listing.id", index=True)
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)  # Price at time of order
    subtotal: float = Field(gt=0)  # quantity * unit_price
    product_title: str  # Denormalized for display (in case product is deleted)


class OrderItem(OrderItemBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    order: Optional[Order] = Relationship(back_populates="items")
    product: Optional["Listing"] = Relationship()


# Response schemas (for API)
class OrderItemRead(OrderItemBase):
    id: int


class OrderRead(OrderBase):
    id: int
    items: List[OrderItemRead] = []


class OrderDetailRead(OrderRead):
    customer: Optional[dict] = None
    seller: Optional[dict] = None
    rider: Optional[dict] = None


class CreateOrderRequest(SQLModel):
    fulfillment_type: FulfillmentType
    address_id: Optional[int] = None  # Required for delivery
    delivery_notes: Optional[str] = None
    pickup_notes: Optional[str] = None
    customer_phone: str
    courier_tip: float = Field(default=0, ge=0)


class UpdateOrderStatusRequest(SQLModel):
    status: OrderStatus
    notes: Optional[str] = None
