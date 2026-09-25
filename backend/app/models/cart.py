from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

if __name__ != "__main__":
    from typing import TYPE_CHECKING
    if TYPE_CHECKING:
        from app.models.user import User
        from app.models.listing import Listing


class CartItemBase(SQLModel):
    cart_id: int = Field(foreign_key="cart.id", index=True)
    product_id: int = Field(foreign_key="listing.id", index=True)
    quantity: int = Field(gt=0, default=1)
    price_at_add: float = Field(gt=0)  # Product price when added to cart


class CartItem(CartItemBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)

    cart: Optional["Cart"] = Relationship(back_populates="items")
    product: Optional["Listing"] = Relationship()


class CartBase(SQLModel):
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    promo_code: Optional[str] = Field(default=None, index=True)
    promo_discount_amount: float = Field(default=0, ge=0)


class Cart(CartBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="cart")
    items: List[CartItem] = Relationship(
        back_populates="cart",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# Response schemas
class CartItemRead(CartItemBase):
    id: int
    product_title: Optional[str] = None
    added_at: datetime


class CartRead(CartBase):
    id: int
    items: List[CartItemRead] = []
    created_at: datetime
    updated_at: datetime

    @property
    def subtotal(self) -> float:
        """Calculate cart subtotal"""
        return sum(item.quantity * item.price_at_add for item in self.items)

    @property
    def total_with_discount(self) -> float:
        """Calculate total after promo discount"""
        return max(0, self.subtotal - self.promo_discount_amount)


class CartSummaryRead(SQLModel):
    """Cart summary with pricing breakdown"""
    subtotal: float
    service_fee: float = 0
    delivery_fee: float = 0
    promo_discount: float = 0
    tax: float = 0
    total: float
    item_count: int


class AddToCartRequest(SQLModel):
    product_id: int
    quantity: int = Field(default=1, gt=0)


class UpdateCartItemRequest(SQLModel):
    quantity: int = Field(gt=0)


class ApplyPromoRequest(SQLModel):
    code: str
