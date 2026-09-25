from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from database import get_db
from models import Seller, Order, User
from schemas import SellerRegister, SellerResponse, SellerUpdate, MPesaVerification, EarningsResponse, WithdrawalRequest, WithdrawalResponse
from utils.security import get_current_user

router = APIRouter(prefix="/sellers", tags=["sellers"])

@router.post("/register", response_model=SellerResponse)
def register_seller(
    seller_data: SellerRegister,
    db: Session = Depends(get_db)
):
    existing = db.query(Seller).filter(Seller.email == seller_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered as seller")

    seller = Seller(
        user_id="temp",
        shop_name=seller_data.shop_name,
        owner_name=seller_data.owner_name,
        email=seller_data.email,
        phone=seller_data.phone,
        mpesa_number=seller_data.mpesa_number,
        shop_address=seller_data.shop_address,
        category=seller_data.category,
        location_lat=seller_data.location["latitude"],
        location_lng=seller_data.location["longitude"],
        verification_status="pending",
        is_active=True
    )
import uuid
from app.models.listing import Listing

def ensure_seller_record(db: Session, user: User) -> Optional[Seller]:
    """
    Ensure that a user who is verified and has at least one active listing
    has an entry in the legacy sellers table.
    """
    if not user.is_verified:
        return None
        
    has_listings = db.query(Listing).filter(Listing.owner_id == user.id, Listing.status == "active").first() is not None
    if not has_listings:
        return None
        
    seller = db.query(Seller).filter(Seller.user_id == str(user.id)).first()
    if seller:
        if not seller.is_active or seller.verification_status != "verified":
            seller.is_active = True
            seller.verification_status = "verified"
            db.commit()
            db.refresh(seller)
        return seller
        
    seller = Seller(
        id=str(uuid.uuid4()),
        user_id=str(user.id),
        shop_name=user.business_name or user.full_name or "My Shop",
        owner_name=user.full_name or "Owner",
        email=user.email,
        phone=user.phone or "000000000",
        mpesa_number=user.phone or "000000000",
        mpesa_verified=True,
        shop_address=user.location or "Default Address",
        category="General",
        verification_status="verified",
        is_active=True,
        location_lat=0.0,
        location_lng=0.0
    )
    db.add(seller)
    try:
        db.commit()
        db.refresh(seller)
        return seller
    except Exception:
        db.rollback()
        return db.query(Seller).filter(Seller.user_id == str(user.id)).first()

@router.post("/register", response_model=SellerResponse)
def register_seller(
    seller_data: SellerRegister,
    db: Session = Depends(get_db)
):
    existing = db.query(Seller).filter(Seller.email == seller_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered as seller")

    seller = Seller(
        user_id="temp",
        shop_name=seller_data.shop_name,
        owner_name=seller_data.owner_name,
        email=seller_data.email,
        phone=seller_data.phone,
        mpesa_number=seller_data.mpesa_number,
        shop_address=seller_data.shop_address,
        category=seller_data.category,
        location_lat=seller_data.location["latitude"],
        location_lng=seller_data.location["longitude"],
        verification_status="verified",
        is_active=True
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller

@router.get("/me", response_model=SellerResponse)
def get_seller_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Ensure seller record is synced/created if they qualify
    seller = ensure_seller_record(db, current_user)
    if not seller:
        # Check if they already have one regardless of listings
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
        
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    return seller

@router.get("/check")
def check_seller_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user is a seller (for header icon display)"""
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    return {"is_seller": seller is not None}

@router.patch("/me", response_model=SellerResponse)
def update_seller_profile(
    seller_data: SellerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    update_data = seller_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(seller, field, value)

    seller.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(seller)
    return seller

@router.post("/verify-mpesa")
def verify_mpesa_number(
    mpesa_data: MPesaVerification,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.user_id == current_user.id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    # TODO: Implement actual M-Pesa verification logic
    seller.mpesa_number = mpesa_data.mpesa_number
    seller.mpesa_verified = True
    seller.updated_at = datetime.utcnow()
    db.commit()

    return {
        "verified": True,
        "message": "M-Pesa number verified successfully"
    }

@router.get("/me/orders")
def get_seller_orders(
    status: str = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all orders for the authenticated seller"""
    from models import SellerVerificationStatus

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    # Check if seller is verified
    if seller.verification_status != SellerVerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=403,
            detail=f"Seller account is {seller.verification_status}. Please complete verification to access orders."
        )

    query = db.query(Order).filter(Order.seller_id == seller.id)
    if status:
        query = query.filter(Order.status == status)

    orders = query.order_by(Order.created_at.desc()).limit(limit).all()

    # Format response with order items
    result = []
    for order in orders:
        from models import OrderItem
        items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        result.append({
            "id": order.id,
            "status": order.status,
            "payment_status": order.payment_status,
            "total_amount": order.total_amount,
            "seller_amount": order.seller_amount,
            "delivery_option": order.delivery_option,
            "delivery_address": order.delivery_address,
            "phone_number": order.phone_number,
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
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None
        })

    return result

@router.get("/me/orders/{order_id}")
def get_seller_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed view of an order"""
    from models import OrderItem

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()

    return {
        "id": order.id,
        "status": order.status,
        "payment_status": order.payment_status,
        "total_amount": order.total_amount,
        "seller_amount": order.seller_amount,
        "platform_fee": order.platform_fee,
        "courier_tip": order.courier_tip,
        "delivery_option": order.delivery_option,
        "delivery_address": order.delivery_address,
        "phone_number": order.phone_number,
        "payment_reference": order.payment_reference,
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
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None
    }

@router.patch("/me/orders/{order_id}")
def update_seller_order_status(
    order_id: str,
    status_update: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update order status - seller can move between CONFIRMED → PREPARING → READY_FOR_PICKUP"""
    from models import SellerVerificationStatus

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    # Check if seller is verified
    if seller.verification_status != SellerVerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=403,
            detail=f"Seller account is {seller.verification_status}. Please complete verification to manage orders."
        )

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = status_update.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")

    # Validate status transitions
    valid_statuses = ["preparing", "ready_for_pickup"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Seller can only set: {', '.join(valid_statuses)}")

    # Only allow status updates for confirmed orders
    if order.status not in ["confirmed", "preparing"]:
        raise HTTPException(status_code=400, detail=f"Cannot update status from {order.status}")

    order.status = new_status
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)

    return {
        "id": order.id,
        "status": order.status,
        "message": f"Order status updated to {new_status}",
        "updated_at": order.updated_at.isoformat() if order.updated_at else None
    }

@router.post("/me/orders/{order_id}/confirm-payment")
def confirm_payment(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.payment_status != "completed":
        raise HTTPException(status_code=400, detail="Payment not completed")

    order.status = "confirmed"
    order.updated_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Payment confirmed",
        "mpesa_ref": order.payment_reference
    }

@router.get("/me/dashboard")
def get_seller_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get seller dashboard with comprehensive analytics"""
    from app.models.listing import Listing
    from models import OrderItem
    from datetime import datetime, timedelta

    # Get seller if exists, but don't require it
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    seller_id = seller.id if seller else None

    # Get today's orders (if seller exists)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = []
    all_orders = []
    if seller_id:
        today_orders = db.query(Order).filter(
            Order.seller_id == seller_id,
            Order.created_at >= today_start
        ).all()
        all_orders = db.query(Order).filter(Order.seller_id == seller_id).all()

    # Calculate metrics
    today_sales = sum(order.total_amount for order in today_orders)
    today_orders_count = len(today_orders)

    pending_orders = len([o for o in all_orders if o.status in ["pending", "confirmed", "preparing"]])
    completed_orders = len([o for o in all_orders if o.status == "delivered"])
    cancelled_orders = len([o for o in all_orders if o.status == "cancelled"])

    total_revenue = sum(order.seller_amount for order in all_orders if order.status == "delivered")

    # Get product count - count active listings by owner_id
    try:
        products = db.query(Listing).filter(Listing.owner_id == current_user.id).all()
        active_products = len([p for p in products if p.status == "active"])
        product_count = len(products)
    except:
        # If query fails, return 0
        active_products = 0
        product_count = 0

    # Get most sold items
    try:
        if seller_id:
            order_items = db.query(OrderItem).join(Order).filter(
                Order.seller_id == seller_id
            ).all()
        else:
            order_items = []

        product_sales = {}
        for item in order_items:
            if item.product_id not in product_sales:
                product_sales[item.product_id] = {
                    "title": item.title,
                    "quantity": 0,
                    "revenue": 0
                }
            product_sales[item.product_id]["quantity"] += item.quantity
            product_sales[item.product_id]["revenue"] += item.price * item.quantity

        top_products = sorted(
            product_sales.items(),
            key=lambda x: x[1]["quantity"],
            reverse=True
        )[:5]
    except:
        top_products = []

    # Calculate average rating - default to 4.5 for now
    average_rating = 4.5

    # Calculate response time (in hours - mock for now)
    response_time = 2  # Average response time in hours

    return {
        "today_sales": today_sales,
        "today_orders_count": today_orders_count,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": total_revenue,
        "average_rating": round(average_rating, 1),
        "response_time": response_time,
        "active_products": active_products,
        "product_count": product_count,
        "top_products": [
            {
                "product_id": pid,
                "title": data["title"],
                "quantity_sold": data["quantity"],
                "revenue": data["revenue"]
            }
            for pid, data in top_products
        ],
        "store_status": "open" if (seller and seller.is_active) else "closed"
    }

@router.get("/me/earnings", response_model=EarningsResponse)
def get_seller_earnings(
    period: str = "monthly",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    # Get all completed orders
    orders = db.query(Order).filter(
        Order.seller_id == seller.id,
        Order.status == "delivered"
    ).all()

    total_earnings = sum(order.seller_amount for order in orders)
    platform_fees = sum(order.platform_fee for order in orders)
    net_earnings = total_earnings - platform_fees

    transactions = [
        {
            "date": order.created_at.isoformat(),
            "amount": order.seller_amount,
            "order_id": order.id
        }
        for order in orders
    ]

    return {
        "total_earnings": total_earnings,
        "platform_fees": platform_fees,
        "net_earnings": net_earnings,
        "transactions": transactions
    }


@router.post("/me/orders/{order_id}/settle-payment")
def settle_order_payment(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Settle payment for a delivered order - credits seller earnings"""
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Order must be delivered before settlement")

    if order.payment_status == "completed":
        raise HTTPException(status_code=400, detail="Payment already settled for this order")

    order.payment_status = "completed"
    order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    return {
        "success": True,
        "order_id": order.id,
        "message": f"Payment settled. Amount credited: KSh {order.seller_amount}",
        "seller_amount": order.seller_amount,
        "platform_fee": order.platform_fee,
        "total_amount": order.total_amount,
        "settled_at": order.updated_at.isoformat() if order.updated_at else None
    }


@router.get("/me/orders/{order_id}/rider-location")
def get_order_rider_location(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current location of rider assigned to order"""
    from models import DeliveryAssignment, Rider

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.order_id == order_id
    ).first()

    if not assignment or not assignment.rider_id:
        raise HTTPException(status_code=404, detail="No rider assigned to this order")

    rider = db.query(Rider).filter(Rider.id == assignment.rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    return {
        "order_id": order_id,
        "rider_id": rider.id,
        "location": {
            "lat": rider.current_lat or 0,
            "lng": rider.current_lng or 0
        },
        "status": assignment.status if assignment else None
    }


@router.post("/me/withdrawals", response_model=WithdrawalResponse)
def request_withdrawal(
    withdrawal_data: WithdrawalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    # TODO: Implement withdrawal logic
    return {
        "id": f"withdrawal_{datetime.utcnow().timestamp()}",
        "amount": withdrawal_data.amount,
        "status": "pending",
        "message": "Withdrawal request submitted. You will receive the amount within 24 hours."
    }

@router.get("/me/withdrawals")
def get_withdrawal_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    # TODO: Implement withdrawal history retrieval
    return []

# Delivery & Rider Management

@router.get("/me/available-riders")
def get_available_riders_for_seller(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of available riders for assigning deliveries"""
    from models import Rider

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    riders = db.query(Rider).filter(Rider.is_active == True).all()

    return [
        {
            "id": rider.id,
            "phone": rider.phone,
            "vehicle_type": rider.vehicle_type,
            "vehicle_plate": rider.vehicle_plate,
            "is_verified": rider.is_verified,
            "current_location": {
                "latitude": rider.current_lat,
                "longitude": rider.current_lng
            }
        }
        for rider in riders
    ]

@router.post("/me/orders/{order_id}/assign-rider")
def assign_rider_to_order(
    order_id: str,
    assignment_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a rider to an order"""
    from models import Rider, DeliveryAssignment

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or you don't own it")

    rider_id = assignment_data.get("rider_id")
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    # Check if order already has an assignment
    existing = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.order_id == order_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Order already has a rider assigned")

    # Create assignment
    assignment = DeliveryAssignment(
        order_id=order_id,
        rider_id=rider_id,
        status="assigned"
    )
    db.add(assignment)
    order.status = "ready_for_pickup"
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assignment)

    return {
        "assignment_id": assignment.id,
        "order_id": assignment.order_id,
        "rider_id": assignment.rider_id,
        "rider_phone": rider.phone,
        "rider_vehicle": f"{rider.vehicle_type} ({rider.vehicle_plate})",
        "status": assignment.status,
        "message": "Rider assigned successfully",
        "created_at": assignment.created_at.isoformat()
    }

@router.get("/me/orders/{order_id}/rider")
def get_order_rider(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get assigned rider info for an order"""
    from models import Rider, DeliveryAssignment

    seller = ensure_seller_record(db, current_user)
    if not seller:
        seller = db.query(Seller).filter(Seller.user_id == str(current_user.id)).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.order_id == order_id
    ).first()

    if not assignment:
        return {"assigned": False, "message": "No rider assigned yet"}

    rider = db.query(Rider).filter(Rider.id == assignment.rider_id).first()

    return {
        "assigned": True,
        "assignment_id": assignment.id,
        "rider_id": rider.id,
        "rider_name": rider.phone,
        "vehicle_type": rider.vehicle_type,
        "vehicle_plate": rider.vehicle_plate,
        "current_location": {
            "latitude": rider.current_lat,
            "longitude": rider.current_lng
        },
        "delivery_status": assignment.status,
        "assigned_at": assignment.created_at.isoformat()
    }
