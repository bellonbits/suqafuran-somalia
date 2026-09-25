from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import logging

from database import get_db
from models import Order, OrderItem, OrderStatus, User, Seller, Payment, Refund
from app.api.deps import get_current_user
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["orders"])

# Get Current User's Orders
@router.get("")
def get_user_orders_current(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get all orders for the authenticated user"""
    try:
        user_id_str = str(current_user.id)
        query = db.query(Order).filter(Order.user_id == user_id_str)

        if status:
            query = query.filter(Order.status == status)

        orders = query.order_by(Order.created_at.desc()).limit(limit).all()

        return [
            {
                "id": order.id,
                "status": order.status,
                "payment_status": order.payment_status,
                "payment_method": order.payment_method,
                "total_amount": order.total_amount,
                "platform_fee": order.platform_fee,
                "seller_amount": order.seller_amount,
                "delivery_address": order.delivery_address,
                "delivery_option": order.delivery_option,
                "phone_number": order.phone_number,
                "courier_tip": order.courier_tip,
                "items": [
                    {
                        "id": item.id,
                        "product_id": item.product_id,
                        "title": item.title,
                        "quantity": item.quantity,
                        "price": item.price
                    }
                    for item in db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
                ],
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "updated_at": order.updated_at.isoformat() if order.updated_at else None
            }
            for order in orders
        ]
    except Exception as e:
        print(f"[Order] Get orders error: {e}")
        # Return empty list gracefully if DB connection limit reached or operational issue occurs
        return []

# Create Order
@router.post("/create")
def create_order(
    user_id: str,
    seller_id: str,
    phone_number: str,
    delivery_address: str,
    location_lat: float,
    location_lng: float,
    delivery_option: str = "delivery",
    payment_method: str = "mpesa",
    items: list = None,
    total_amount: float = 0,
    courier_tip: float = 0,
    db: Session = Depends(get_db)
):
    """Create a new order"""
    try:
        # For COD, skip payment pending status
        if payment_method == "cash_on_delivery":
            order_status = OrderStatus.CONFIRMED
            payment_status = "pending_at_delivery"
        else:
            order_status = OrderStatus.PAYMENT_PENDING
            payment_status = "pending"

        order = Order(
            id=f"ORD-{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            seller_id=seller_id,
            phone_number=phone_number,
            delivery_address=delivery_address,
            location_lat=location_lat,
            location_lng=location_lng,
            delivery_option=delivery_option,
            payment_method=payment_method,
            total_amount=total_amount,
            platform_fee=total_amount * 0.05,  # 5% platform fee
            seller_amount=total_amount * 0.95,
            courier_tip=courier_tip,
            status=order_status,
            payment_status=payment_status
        )
        db.add(order)

        # Add order items
        if items:
            for item in items:
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=item.get("id", ""),
                    title=item.get("title", ""),
                    quantity=item.get("quantity", 1),
                    price=item.get("price", 0)
                )
                db.add(order_item)

        db.commit()
        db.refresh(order)

        return {
            "success": True,
            "order_id": order.id,
            "status": order.status,
            "message": "Order created successfully"
        }
    except Exception as e:
        print(f"[Order] Create error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

# Get Order
@router.get("/{order_id}")
def get_order(order_id: str, db: Session = Depends(get_db)):
    """Get order details"""
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()

        return {
            "id": order.id,
            "user_id": order.user_id,
            "seller_id": order.seller_id,
            "status": order.status,
            "payment_status": order.payment_status,
            "delivery_option": order.delivery_option,
            "delivery_address": order.delivery_address,
            "phone_number": order.phone_number,
            "total_amount": order.total_amount,
            "platform_fee": order.platform_fee,
            "seller_amount": order.seller_amount,
            "courier_tip": order.courier_tip,
            "items": [
                {
                    "id": item.id,
                    "product_id": item.product_id,
                    "title": item.title,
                    "quantity": item.quantity,
                    "price": item.price
                }
                for item in items
            ],
            "created_at": order.created_at,
            "updated_at": order.updated_at
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get User Orders
@router.get("/user/{user_id}")
def get_user_orders(
    user_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all orders for a user"""
    try:
        query = db.query(Order).filter(Order.user_id == user_id)

        if status:
            query = query.filter(Order.status == status)

        orders = query.order_by(Order.created_at.desc()).all()

        return {
            "success": True,
            "count": len(orders),
            "orders": [
                {
                    "id": order.id,
                    "status": order.status,
                    "payment_status": order.payment_status,
                    "total_amount": order.total_amount,
                    "delivery_address": order.delivery_address,
                    "created_at": order.created_at,
                    "updated_at": order.updated_at
                }
                for order in orders
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update Order Status (after payment)
@router.post("/{order_id}/confirm-payment")
def confirm_payment(
    order_id: str,
    payment_reference: str = "",
    db: Session = Depends(get_db)
):
    """Confirm payment and process order for delivery"""
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Update order status to confirmed
        order.status = OrderStatus.CONFIRMED
        order.payment_status = "completed"
        order.payment_reference = payment_reference
        order.updated_at = datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "order_id": order.id,
            "status": order.status,
            "message": "Order confirmed and ready for delivery"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Update Delivery Status
@router.post("/{order_id}/delivery-status")
def update_delivery_status(
    order_id: str,
    new_status: str,
    db: Session = Depends(get_db)
):
    """Update order delivery status"""
    valid_statuses = [
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.IN_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED
    ]

    if new_status not in [s.value for s in valid_statuses]:
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        order.status = new_status
        order.updated_at = datetime.utcnow()
        db.commit()

        # ── RETENTION FUNNEL: delivery status notifications ──────────────────
        try:
            from app.tasks.retention_tasks import notify_order_dispatched, notify_order_delivered

            buyer = db.query(User).filter(User.id == order.user_id).first()
            seller = db.query(Seller).filter(Seller.id == order.seller_id).first()

            if buyer and buyer.email:
                buyer_name = getattr(buyer, "full_name", None) or "Valued Customer"
                buyer_email = buyer.email
                buyer_phone = getattr(buyer, "phone", "") or getattr(order, "phone_number", "") or ""
                seller_name = getattr(seller, "business_name", None) or "Seller"
                items_list = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
                first_item_id = items_list[0].product_id if items_list else None

                if new_status == OrderStatus.IN_DELIVERY.value:
                    notify_order_dispatched.apply_async(kwargs={
                        "user_id": buyer.id,
                        "buyer_name": buyer_name,
                        "buyer_email": buyer_email,
                        "buyer_phone": buyer_phone,
                        "order_id": order_id,
                        "seller_name": seller_name,
                        "estimated_delivery": "Within 24 hours",
                    })

                elif new_status == OrderStatus.DELIVERED.value:
                    notify_order_delivered.apply_async(kwargs={
                        "user_id": buyer.id,
                        "buyer_name": buyer_name,
                        "buyer_email": buyer_email,
                        "order_id": order_id,
                        "seller_name": seller_name,
                        "listing_id": first_item_id,
                    })
        except Exception as notif_err:
            logger.warning(f"[Order] Retention notification failed (non-critical): {notif_err}")
        # ─────────────────────────────────────────────────────────────────────

        return {
            "success": True,
            "order_id": order.id,
            "status": order.status,
            "message": f"Order status updated to {new_status}"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Order Cancellation and Refunds

@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: str,
    cancellation_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel an order and initiate refund"""
    reason = cancellation_data.get("reason", "User requested cancellation")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if user owns the order
    if order.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only cancel your own orders")

    # Can't cancel if already delivered or cancelled
    if order.status in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order with status: {order.status}")

    # Can't cancel if in delivery (rider has it)
    if order.status == "in_delivery":
        raise HTTPException(status_code=400, detail="Cannot cancel order that is being delivered")

    try:
        # Mark order as cancelled
        order.status = OrderStatus.CANCELLED
        order.updated_at = datetime.utcnow()

        # Create refund record
        refund = Refund(
            order_id=order_id,
            amount=order.total_amount,
            reason=reason,
            status="processing"
        )
        db.add(refund)
        db.commit()
        db.refresh(refund)

        return {
            "success": True,
            "order_id": order.id,
            "status": order.status,
            "refund_id": refund.id,
            "refund_amount": refund.amount,
            "refund_status": refund.status,
            "message": "Order cancelled. Refund is being processed."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{order_id}/process-refund")
def process_refund(
    order_id: str,
    db: Session = Depends(get_db)
):
    """Process refund for a cancelled order (simulate M-Pesa refund)"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    refund = db.query(Refund).filter(Refund.order_id == order_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="No refund found for this order")

    if refund.status == "completed":
        raise HTTPException(status_code=400, detail="Refund already completed")

    try:
        # Simulate M-Pesa refund
        import hashlib
        refund_ref = hashlib.md5(f"{order_id}refund".encode()).hexdigest()[:12].upper()

        refund.status = "completed"
        refund.refund_reference = f"REF{refund_ref}"
        refund.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(refund)

        return {
            "success": True,
            "order_id": order_id,
            "refund_id": refund.id,
            "refund_amount": refund.amount,
            "refund_reference": refund.refund_reference,
            "refund_status": refund.status,
            "message": f"Refund of KSh {refund.amount} has been processed",
            "completed_at": refund.updated_at.isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{order_id}/refund-status")
def get_refund_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get refund status for an order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if user owns the order
    if order.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only view your own orders")

    refund = db.query(Refund).filter(Refund.order_id == order_id).first()

    if not refund:
        return {
            "has_refund": False,
            "message": "No refund for this order"
        }

    return {
        "has_refund": True,
        "order_id": order_id,
        "refund_id": refund.id,
        "refund_amount": refund.amount,
        "reason": refund.reason,
        "status": refund.status,
        "refund_reference": refund.refund_reference,
        "created_at": refund.created_at.isoformat(),
        "updated_at": refund.updated_at.isoformat()
    }
