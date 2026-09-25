from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import List, Optional
import asyncio

from app.models.order import Order, OrderItem, OrderRead, OrderDetailRead, CreateOrderRequest, UpdateOrderStatusRequest, OrderStatus, FulfillmentType
from app.models.cart import Cart, CartItem
from app.models.user import User
from app.models.listing import Listing
from app.models.saved_address import SavedAddress
from app.db import get_session
from app.utils.security import get_current_user
from app.services.notification_integration import NotificationIntegrationService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderRead, status_code=201)
async def create_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create order from cart (checkout)"""
    # Get user's cart
    cart = session.exec(select(Cart).where(Cart.user_id == current_user.id)).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Validate fulfillment type
    if request.fulfillment_type == FulfillmentType.delivery and not request.address_id:
        raise HTTPException(status_code=400, detail="Address required for delivery")

    # Verify address if provided
    if request.address_id:
        address = session.exec(select(SavedAddress).where(SavedAddress.id == request.address_id)).first()
        if not address or address.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Address not found")

    # Group items by seller
    items_by_seller = {}
    for cart_item in cart.items:
        product = session.exec(select(Listing).where(Listing.id == cart_item.product_id)).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} not found")

        seller_id = product.owner_id
        if seller_id not in items_by_seller:
            items_by_seller[seller_id] = []
        items_by_seller[seller_id].append((cart_item, product))

    # Create separate order for each seller
    orders = []
    for seller_id, items in items_by_seller.items():
        # Calculate pricing
        subtotal = sum(item.quantity * item.price_at_add for item, _ in items)
        service_fee = subtotal * 0.1  # 10% platform fee
        delivery_fee = 0 if request.fulfillment_type == FulfillmentType.pickup else 149  # KSh 149
        tax = (subtotal + service_fee + delivery_fee) * 0.16  # 16% VAT
        discount = cart.promo_discount_amount / len(items_by_seller)  # Split discount

        total_amount = subtotal + service_fee + delivery_fee + tax - discount + request.courier_tip

        # Create order
        order = Order(
            customer_id=current_user.id,
            seller_id=seller_id,
            fulfillment_type=request.fulfillment_type,
            address_id=request.address_id,
            delivery_notes=request.delivery_notes,
            pickup_notes=request.pickup_notes,
            status=OrderStatus.pending,
            customer_phone=request.customer_phone,
            subtotal=subtotal,
            service_fee=service_fee,
            delivery_fee=delivery_fee,
            courier_tip=request.courier_tip,
            discount_amount=discount,
            tax_amount=tax,
            total_amount=total_amount
        )

        # Add order items
        for cart_item, product in items:
            order_item = OrderItem(
                order=order,
                product_id=product.id,
                quantity=cart_item.quantity,
                unit_price=cart_item.price_at_add,
                subtotal=cart_item.quantity * cart_item.price_at_add,
                product_title=product.title_en
            )
            order.items.append(order_item)

        session.add(order)
        orders.append(order)

    # Clear cart
    for item in cart.items:
        session.delete(item)
    cart.promo_code = None
    cart.promo_discount_amount = 0

    session.commit()
    session.refresh(orders[0])

    # Send notification for order creation (async, don't wait)
    for order in orders:
        asyncio.create_task(
            NotificationIntegrationService.send_order_notification(
                order=order,
                notification_type="order_created",
                session=session,
            )
        )

    return orders[0]


@router.get("", response_model=List[OrderRead])
async def list_orders(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    role: str = Query("customer", description="customer, seller, or rider"),
    skip: int = 0,
    limit: int = 20,
    session: Session = Depends(get_session)
):
    """List orders (customer can see own, seller/rider see assigned)"""
    if role == "customer":
        query = select(Order).where(Order.customer_id == current_user.id)
    elif role == "seller":
        query = select(Order).where(Order.seller_id == current_user.id)
    elif role == "rider":
        query = select(Order).where(Order.rider_id == current_user.id)
    else:
        raise HTTPException(status_code=400, detail="Invalid role")

    if status:
        query = query.where(Order.status == status)

    query = query.offset(skip).limit(limit).order_by(Order.created_at.desc())
    orders = session.exec(query).all()
    return orders


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get order details"""
    order = session.exec(select(Order).where(Order.id == order_id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions
    if not (
        order.customer_id == current_user.id or
        order.seller_id == current_user.id or
        order.rider_id == current_user.id or
        current_user.is_admin
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    return order


@router.patch("/{order_id}/status", response_model=OrderRead)
async def update_order_status(
    order_id: int,
    request: UpdateOrderStatusRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update order status"""
    order = session.exec(select(Order).where(Order.id == order_id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions (seller can confirm/pack, rider can mark delivered)
    if order.seller_id == current_user.id and request.status in [OrderStatus.confirmed, OrderStatus.packed, OrderStatus.ready_for_pickup]:
        pass
    elif order.rider_id == current_user.id and request.status in [OrderStatus.in_transit, OrderStatus.delivered]:
        pass
    elif current_user.is_admin:
        pass
    elif order.customer_id == current_user.id and request.status in [OrderStatus.cancelled]:
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized for this status update")

    old_status = order.status
    order.status = request.status
    if request.notes:
        order.notes = request.notes

    # Update timestamps
    if request.status == OrderStatus.confirmed:
        order.confirmed_at = datetime.utcnow()
    elif request.status == OrderStatus.shipped:
        order.shipped_at = datetime.utcnow()
    elif request.status == OrderStatus.delivered:
        order.delivered_at = datetime.utcnow()

    session.add(order)
    session.commit()
    session.refresh(order)

    # Send notification based on status change
    status_to_notification = {
        OrderStatus.confirmed: "order_confirmed",
        OrderStatus.packed: "order_packed",
        OrderStatus.in_transit: "order_in_transit",
        OrderStatus.delivered: "order_delivered",
        OrderStatus.ready_for_pickup: "order_packed",  # Same as packed for pickup
    }

    if order.status in status_to_notification:
        notification_type = status_to_notification[order.status]
        extra_data = {}

        # Add rider info if assigned
        if order.rider_id:
            rider = session.exec(select(User).where(User.id == order.rider_id)).first()
            if rider:
                extra_data["rider_name"] = rider.full_name or "Your Rider"
                extra_data["rider_phone"] = rider.phone
                extra_data["estimated_time"] = 30  # Placeholder

        asyncio.create_task(
            NotificationIntegrationService.send_order_notification(
                order=order,
                notification_type=notification_type,
                session=session,
                extra_data=extra_data if extra_data else None,
            )
        )

    return order


@router.post("/{order_id}/cancel", response_model=OrderRead)
async def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Cancel order (before shipped)"""
    order = session.exec(select(Order).where(Order.id == order_id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions
    if order.customer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Can only cancel if not yet shipped
    if order.status in [OrderStatus.shipped, OrderStatus.in_transit, OrderStatus.delivered, OrderStatus.cancelled]:
        raise HTTPException(status_code=400, detail="Cannot cancel this order")

    order.status = OrderStatus.cancelled
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


@router.get("/{order_id}/tracking", response_model=dict)
async def get_order_tracking(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get real-time tracking info"""
    order = session.exec(select(Order).where(Order.id == order_id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions
    if order.customer_id != current_user.id and order.rider_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    tracking_data = {
        "order_id": order.id,
        "status": order.status,
        "fulfillment_type": order.fulfillment_type,
        "created_at": order.created_at,
        "estimated_delivery": (
            order.created_at + timedelta(minutes=30)
            if order.fulfillment_type == FulfillmentType.delivery
            else None
        ),
        "rider": None if not order.rider_id else {
            "id": order.rider_id,
            "phone": order.rider.phone if order.rider else None
        },
        "location": {
            "latitude": None,
            "longitude": None,
            "updated_at": None
        }
    }

    return tracking_data


@router.get("/{order_id}/items", response_model=List[dict])
async def get_order_items(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get order items"""
    order = session.exec(select(Order).where(Order.id == order_id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions
    if not (
        order.customer_id == current_user.id or
        order.seller_id == current_user.id or
        current_user.is_admin
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    items = []
    for item in order.items:
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_title": item.product_title,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal
        })

    return items
