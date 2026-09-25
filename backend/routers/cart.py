from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from typing import Optional, List
import asyncio

from app.models.cart import Cart, CartItem, CartItemRead, CartRead, CartSummaryRead, AddToCartRequest, UpdateCartItemRequest, ApplyPromoRequest
from app.models.listing import Listing
from app.models.marketing_code import MarketingCode
from app.models.user import User
from app.db import get_session
from app.utils.security import get_current_user
from app.services.notification_integration import NotificationIntegrationService

router = APIRouter(prefix="/cart", tags=["cart"])


def get_user_cart(user_id: int, session: Session) -> Cart:
    """Get or create user's cart"""
    cart = session.exec(select(Cart).where(Cart.user_id == user_id)).first()
    if not cart:
        cart = Cart(user_id=user_id)
        session.add(cart)
        session.commit()
        session.refresh(cart)
    return cart


@router.get("", response_model=CartRead)
async def get_cart(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get user's shopping cart"""
    cart = get_user_cart(current_user.id, session)
    session.refresh(cart)
    return cart


@router.post("/items", response_model=CartItemRead)
async def add_to_cart(
    request: AddToCartRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Add product to cart"""
    # Verify product exists
    product = session.exec(select(Listing).where(Listing.id == request.product_id)).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    cart = get_user_cart(current_user.id, session)

    # Check if product already in cart
    existing_item = session.exec(
        select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == request.product_id
        )
    ).first()

    if existing_item:
        # Update quantity
        existing_item.quantity += request.quantity
        session.add(existing_item)
    else:
        # Create new cart item
        item = CartItem(
            cart_id=cart.id,
            product_id=request.product_id,
            quantity=request.quantity,
            price_at_add=product.price
        )
        session.add(item)

    session.commit()
    if existing_item:
        session.refresh(existing_item)
        return existing_item
    session.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
async def remove_from_cart(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Remove item from cart"""
    item = session.exec(select(CartItem).where(CartItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    # Verify item belongs to user's cart
    cart = get_user_cart(current_user.id, session)
    if item.cart_id != cart.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    session.delete(item)
    session.commit()


@router.patch("/items/{item_id}", response_model=CartItemRead)
async def update_cart_item(
    item_id: int,
    request: UpdateCartItemRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update cart item quantity"""
    item = session.exec(select(CartItem).where(CartItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    # Verify item belongs to user's cart
    cart = get_user_cart(current_user.id, session)
    if item.cart_id != cart.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if request.quantity <= 0:
        session.delete(item)
    else:
        item.quantity = request.quantity
        session.add(item)

    session.commit()
    if request.quantity > 0:
        session.refresh(item)
        return item


@router.delete("", status_code=204)
async def clear_cart(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Clear entire cart"""
    cart = get_user_cart(current_user.id, session)

    # Delete all items
    session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    )
    for item in cart.items:
        session.delete(item)

    # Reset promo code
    cart.promo_code = None
    cart.promo_discount_amount = 0

    session.add(cart)
    session.commit()


@router.post("/promo", response_model=CartRead)
async def apply_promo_code(
    request: ApplyPromoRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Apply promotional code to cart"""
    cart = get_user_cart(current_user.id, session)

    # Verify promo code exists and is valid
    promo = session.exec(
        select(MarketingCode).where(
            MarketingCode.code == request.code.upper()
        )
    ).first()

    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")

    if not promo.is_active:
        raise HTTPException(status_code=400, detail="Promo code is not active")

    # Calculate discount
    subtotal = sum(item.quantity * item.price_at_add for item in cart.items)

    if promo.discount_type == "percentage":
        discount = (subtotal * promo.discount_value) / 100
    else:  # fixed amount
        discount = promo.discount_value

    cart.promo_code = request.code.upper()
    cart.promo_discount_amount = min(discount, subtotal)  # Can't exceed subtotal

    session.add(cart)
    session.commit()
    session.refresh(cart)
    return cart


@router.delete("/promo/{code}", status_code=204)
async def remove_promo_code(
    code: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Remove promo code from cart"""
    cart = get_user_cart(current_user.id, session)

    if cart.promo_code != code.upper():
        raise HTTPException(status_code=400, detail="Promo code not applied to cart")

    cart.promo_code = None
    cart.promo_discount_amount = 0

    session.add(cart)
    session.commit()


@router.get("/summary", response_model=CartSummaryRead)
async def get_cart_summary(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get cart summary with pricing breakdown"""
    cart = get_user_cart(current_user.id, session)

    # Calculate totals
    subtotal = sum(item.quantity * item.price_at_add for item in cart.items)

    # Service fee: 10%
    service_fee = subtotal * 0.1

    # Delivery fee: KSh 149 (or 0 for pickup - simplified for now)
    delivery_fee = 149

    # Tax: 16% (Kenya VAT)
    tax = (subtotal + service_fee + delivery_fee) * 0.16

    # Discount
    discount = cart.promo_discount_amount

    # Total
    total = subtotal + service_fee + delivery_fee + tax - discount

    return CartSummaryRead(
        subtotal=subtotal,
        service_fee=service_fee,
        delivery_fee=delivery_fee,
        promo_discount=discount,
        tax=tax,
        total=total,
        item_count=len(cart.items)
    )


@router.post("/validate", response_model=dict)
async def validate_cart(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Validate cart before checkout"""
    cart = get_user_cart(current_user.id, session)

    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Check all products still exist and have stock
    for item in cart.items:
        product = session.exec(select(Listing).where(Listing.id == item.product_id)).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} no longer exists")

        if not product.status == "active":
            raise HTTPException(status_code=400, detail=f"Product '{product.title_en}' is no longer available")

    return {
        "valid": True,
        "message": "Cart is valid and ready for checkout",
        "item_count": len(cart.items)
    }


@router.post("/check-abandoned", response_model=dict, tags=["admin"])
async def check_abandoned_carts(
    hours_threshold: int = 2,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check and send notifications for abandoned carts (admin endpoint)
    Sends email and SMS reminders to users with items in cart for >N hours
    """
    # TODO: Add admin permission check
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can trigger abandoned cart checks")

    # Run notification check in background
    asyncio.create_task(
        NotificationIntegrationService.check_and_notify_abandoned_carts(
            session=session,
            hours_threshold=hours_threshold,
        )
    )

    return {
        "status": "success",
        "message": f"Abandoned cart check initiated for carts untouched for {hours_threshold} hours",
        "notification": "Check will run asynchronously"
    }
