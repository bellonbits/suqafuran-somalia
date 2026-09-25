from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from math import radians, sin, cos, sqrt, atan2

from database import get_db
from models import Rider, User, Order, DeliveryAssignment, RiderEarnings, RiderDeliveryStatus, OrderItem, RiderWithdrawal, WithdrawalStatus
from schemas import RiderRegister, RiderResponse, RiderLocationUpdate, DeliveryAssignmentResponse, DeliveryStatusUpdate
from utils.security import get_current_user

router = APIRouter(prefix="/riders", tags=["riders"])

# Helper function to calculate distance between two coordinates (in km)
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in kilometers

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c

    return round(distance, 2)

@router.post("/register", response_model=RiderResponse)
def register_rider(
    rider_data: RiderRegister,
    db: Session = Depends(get_db)
):
    # Create user first if needed
    existing_user = db.query(User).filter(User.phone == rider_data.phone).first()

    if not existing_user:
        user = User(
            email=f"rider_{rider_data.phone}@suqafuran.com",
            phone=rider_data.phone,
            full_name=rider_data.full_name or "Rider",
            is_verified=False
        )
        db.add(user)
        db.flush()
        user_id = user.id
    else:
        user_id = existing_user.id

    # Create rider profile
    rider = Rider(
        user_id=user_id,
        phone=rider_data.phone,
        vehicle_type=rider_data.vehicle_type,
        vehicle_plate=rider_data.vehicle_plate,
        is_verified=False,
        is_active=True,
        current_lat=rider_data.current_location.get("latitude", 0),
        current_lng=rider_data.current_location.get("longitude", 0)
    )
    db.add(rider)
    db.commit()
    db.refresh(rider)

    return {
        "id": rider.id,
        "phone": rider.phone,
        "vehicle_type": rider.vehicle_type,
        "vehicle_plate": rider.vehicle_plate,
        "is_verified": rider.is_verified,
        "is_active": rider.is_active
    }


@router.get("/available")
def get_available_riders(
    limit: int = Query(10, ge=1, le=50),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get list of available riders for order assignment"""
    try:
        from sqlalchemy import text

        result = db.execute(text("""
            SELECT id, phone, is_active, is_verified, current_lat, current_lng
            FROM riders
            WHERE is_active = true AND is_verified = true
            LIMIT :limit OFFSET :skip
        """), {"limit": limit, "skip": skip})

        available_riders = []
        for row in result:
            rider_id, phone, is_active, is_verified, lat, lng = row

            try:
                active_count = db.query(DeliveryAssignment).filter(
                    DeliveryAssignment.rider_id == rider_id,
                    DeliveryAssignment.status.in_(["assigned", "picked_up"])
                ).count()
            except:
                active_count = 0

            available_riders.append({
                "id": str(rider_id),
                "name": "Rider",
                "phone": phone or "",
                "rating": 5.0,
                "active_deliveries": active_count,
                "location": {
                    "lat": float(lat or 0),
                    "lng": float(lng or 0)
                }
            })

        return {
            "riders": available_riders,
            "total": len(available_riders)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{rider_id}", response_model=RiderResponse)
def get_rider_profile(
    rider_id: str,
    db: Session = Depends(get_db)
):
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    return {
        "id": rider.id,
        "phone": rider.phone,
        "vehicle_type": rider.vehicle_type,
        "vehicle_plate": rider.vehicle_plate,
        "is_verified": rider.is_verified,
        "is_active": rider.is_active
    }


@router.post("/{rider_id}/location")
def update_rider_location(
    rider_id: str,
    location_data: RiderLocationUpdate,
    db: Session = Depends(get_db)
):
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    rider.current_lat = location_data.latitude
    rider.current_lng = location_data.longitude
    rider.updated_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Location updated successfully"
    }

@router.post("/assignments/assign")
def assign_delivery(
    assignment_data: dict,
    db: Session = Depends(get_db)
):
    order_id = assignment_data.get("order_id")
    rider_id = assignment_data.get("rider_id")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    # Create delivery assignment
    assignment = DeliveryAssignment(
        order_id=order_id,
        rider_id=rider_id,
        status="assigned"
    )
    db.add(assignment)
    order.status = "in_delivery"
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assignment)

    return {
        "id": assignment.id,
        "order_id": assignment.order_id,
        "rider_id": assignment.rider_id,
        "status": assignment.status,
        "created_at": assignment.created_at
    }

@router.get("/assignments/{assignment_id}", response_model=DeliveryAssignmentResponse)
def get_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return {
        "id": assignment.id,
        "order_id": assignment.order_id,
        "rider_id": assignment.rider_id,
        "status": assignment.status,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at
    }

@router.patch("/assignments/{assignment_id}")
def update_assignment_status(
    assignment_id: str,
    status_update: DeliveryStatusUpdate,
    db: Session = Depends(get_db)
):
    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.status = status_update.status
    assignment.updated_at = datetime.utcnow()

    # Update order status
    order = db.query(Order).filter(Order.id == assignment.order_id).first()
    if order:
        if status_update.status == "delivered":
            order.status = "delivered"
        elif status_update.status == "picked_up":
            order.status = "in_delivery"

        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(assignment)

    return {
        "id": assignment.id,
        "order_id": assignment.order_id,
        "rider_id": assignment.rider_id,
        "status": assignment.status,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at
    }

@router.get("/{rider_id}/assignments")
def get_rider_assignments(
    rider_id: str,
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeliveryAssignment).filter(DeliveryAssignment.rider_id == rider_id)
    if status:
        query = query.filter(DeliveryAssignment.status == status)

    assignments = query.all()
    return assignments


# ===================== SPRINT 1 ENDPOINTS =====================

@router.get("/me/available-deliveries")
def get_available_deliveries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    max_distance: float = Query(50, description="Maximum distance in km"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Get list of available (unassigned) deliveries near rider's current location.
    Returns orders that are:
    - Ready for pickup (status: ready_for_pickup)
    - Within max_distance from rider
    - Not yet assigned to a rider
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    if rider.current_lat is None or rider.current_lng is None:
        raise HTTPException(status_code=400, detail="Rider location not set")

    # Get available orders (ready for pickup and not yet assigned)
    query = db.query(Order).filter(
        Order.delivery_option == "delivery",
        Order.status.in_(["ready_for_pickup", "pending"])
    )

    # Get all unassigned orders
    assigned_order_ids = db.query(DeliveryAssignment.order_id).all()
    assigned_order_ids = [aid[0] for aid in assigned_order_ids]
    query = query.filter(~Order.id.in_(assigned_order_ids)) if assigned_order_ids else query

    orders = query.all()

    # Filter by distance and enrich with delivery info
    available_orders = []
    for order in orders:
        distance = calculate_distance(
            rider.current_lat,
            rider.current_lng,
            order.location_lat,
            order.location_lng
        )

        if distance <= max_distance:
            items_count = db.query(OrderItem).filter(OrderItem.order_id == order.id).count()

            available_orders.append({
                "order_id": order.id,
                "distance_km": distance,
                "delivery_fee": order.courier_tip or 100,  # Base fee
                "items_count": items_count,
                "pickup_location": order.seller_id,  # In real app, get seller location
                "delivery_address": order.delivery_address,
                "customer_rating": 4.5,  # In real app, calculate from ratings
                "total_amount": order.total_amount,
                "created_at": order.created_at.isoformat() if order.created_at else None
            })

    # Sort by distance (closest first)
    available_orders.sort(key=lambda x: x["distance_km"])

    # Pagination
    skip = (page - 1) * limit
    paginated_orders = available_orders[skip:skip + limit]

    return {
        "total": len(available_orders),
        "page": page,
        "limit": limit,
        "deliveries": paginated_orders
    }


@router.get("/me/dashboard")
def get_rider_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get rider's dashboard with key metrics:
    - Today's earnings
    - Total deliveries this week
    - Average rating
    - Completion rate (%)
    - Next scheduled delivery (if any)
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Calculate today's earnings
    today = datetime.utcnow().date()
    today_earnings = db.query(RiderEarnings).filter(
        RiderEarnings.rider_id == rider.id,
        RiderEarnings.date >= datetime.combine(today, datetime.min.time())
    ).all()
    today_total = sum(e.total_earned for e in today_earnings) if today_earnings else 0.0

    # Calculate this week's deliveries
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_deliveries = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.rider_id == rider.id,
        DeliveryAssignment.status == RiderDeliveryStatus.DELIVERED,
        DeliveryAssignment.delivery_completed_at >= week_ago
    ).count()

    # Get completion rate (completed vs total)
    total_deliveries = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.rider_id == rider.id
    ).count()
    completed_deliveries = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.rider_id == rider.id,
        DeliveryAssignment.status == RiderDeliveryStatus.DELIVERED
    ).count()
    completion_rate = (completed_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0

    # Get average rating
    ratings = db.query(DeliveryAssignment.customer_rating).filter(
        DeliveryAssignment.rider_id == rider.id,
        DeliveryAssignment.customer_rating.isnot(None)
    ).all()
    avg_rating = sum(r[0] for r in ratings) / len(ratings) if ratings else 0

    # Get next scheduled delivery
    next_delivery = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.rider_id == rider.id,
        DeliveryAssignment.status.in_([
            RiderDeliveryStatus.ASSIGNED,
            RiderDeliveryStatus.PICKED_UP,
            RiderDeliveryStatus.IN_TRANSIT
        ])
    ).order_by(DeliveryAssignment.created_at).first()

    next_delivery_info = None
    if next_delivery:
        order = db.query(Order).filter(Order.id == next_delivery.order_id).first()
        if order:
            next_delivery_info = {
                "delivery_id": next_delivery.id,
                "order_id": order.id,
                "status": next_delivery.status,
                "destination": order.delivery_address,
                "created_at": next_delivery.created_at.isoformat() if next_delivery.created_at else None
            }

    return {
        "today_earnings": round(today_total, 2),
        "deliveries_this_week": week_deliveries,
        "average_rating": round(avg_rating, 2),
        "completion_rate_percent": round(completion_rate, 2),
        "total_deliveries": total_deliveries,
        "next_delivery": next_delivery_info,
        "availability_status": rider.availability_status
    }


# ===================== SPRINT 2 ENDPOINTS =====================

@router.post("/assignments/{assignment_id}/confirm-pickup")
def confirm_pickup(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Confirm that rider has picked up the order from seller.
    Updates assignment status to picked_up and records timestamp.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get assignment and verify rider ownership
    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.id == assignment_id,
        DeliveryAssignment.rider_id == rider.id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not owned by rider")

    # Update assignment status
    assignment.status = RiderDeliveryStatus.PICKED_UP
    assignment.pickup_confirmed_at = datetime.utcnow()
    assignment.updated_at = datetime.utcnow()

    # Update order status
    order = db.query(Order).filter(Order.id == assignment.order_id).first()
    if order:
        order.status = "in_delivery"
        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(assignment)

    return {
        "success": True,
        "assignment_id": assignment.id,
        "status": assignment.status,
        "pickup_confirmed_at": assignment.pickup_confirmed_at.isoformat(),
        "message": "Pickup confirmed successfully"
    }


@router.post("/assignments/{assignment_id}/start-delivery")
def start_delivery(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark delivery as in transit.
    Updates assignment status to in_transit and enables real-time tracking.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get assignment and verify rider ownership
    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.id == assignment_id,
        DeliveryAssignment.rider_id == rider.id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not owned by rider")

    # Update assignment status
    assignment.status = RiderDeliveryStatus.IN_TRANSIT
    assignment.updated_at = datetime.utcnow()

    # Update order status
    order = db.query(Order).filter(Order.id == assignment.order_id).first()
    if order:
        order.status = "in_delivery"
        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(assignment)

    return {
        "success": True,
        "assignment_id": assignment.id,
        "status": assignment.status,
        "message": "Delivery in transit - real-time tracking enabled"
    }


@router.post("/assignments/{assignment_id}/complete-delivery")
def complete_delivery(
    assignment_id: str,
    completion_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark delivery as completed.
    Accepts optional photo evidence URL, records timestamp, calculates final earnings.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get assignment and verify rider ownership
    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.id == assignment_id,
        DeliveryAssignment.rider_id == rider.id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not owned by rider")

    # Update assignment
    assignment.status = RiderDeliveryStatus.DELIVERED
    assignment.delivery_completed_at = datetime.utcnow()
    assignment.proof_of_delivery_url = completion_data.get("proof_photo_url")
    assignment.updated_at = datetime.utcnow()

    # Calculate final earnings
    # Base fee: KSh 50-150 per delivery
    base_fee = 100  # Default, can vary by distance
    distance_bonus = 0  # KSh 5 per km (can be calculated if distance data available)
    speed_bonus = 0  # 10% for deliveries 5+ min early
    rating_bonus = 0  # Will be added after customer rates

    final_earnings = base_fee + distance_bonus + speed_bonus + rating_bonus
    assignment.final_earnings = final_earnings

    # Create earnings record
    earnings = RiderEarnings(
        rider_id=rider.id,
        delivery_id=assignment.id,
        base_fee=base_fee,
        distance_bonus=distance_bonus,
        speed_bonus=speed_bonus,
        rating_bonus=rating_bonus,
        total_earned=final_earnings
    )
    db.add(earnings)

    # Update order status
    order = db.query(Order).filter(Order.id == assignment.order_id).first()
    if order:
        order.status = "delivered"
        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(assignment)

    return {
        "success": True,
        "assignment_id": assignment.id,
        "status": assignment.status,
        "delivery_completed_at": assignment.delivery_completed_at.isoformat(),
        "final_earnings": final_earnings,
        "message": "Delivery completed successfully"
    }


@router.post("/assignments/{assignment_id}/upload-proof-of-delivery")
def upload_proof_of_delivery(
    assignment_id: str,
    proof_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload proof of delivery (image URL).
    Validates and stores the proof URL in the database.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get assignment and verify rider ownership
    assignment = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.id == assignment_id,
        DeliveryAssignment.rider_id == rider.id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not owned by rider")

    # Get proof URL
    proof_url = proof_data.get("proof_photo_url")
    if not proof_url:
        raise HTTPException(status_code=400, detail="Proof photo URL required")

    # Store proof URL
    assignment.proof_of_delivery_url = proof_url
    assignment.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(assignment)

    return {
        "success": True,
        "assignment_id": assignment.id,
        "proof_of_delivery_url": assignment.proof_of_delivery_url,
        "message": "Proof of delivery uploaded successfully"
    }


# ===================== SPRINT 3 ENDPOINTS =====================

@router.get("/me/earnings")
def get_earnings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    start_date: str = Query(None, description="ISO format date YYYY-MM-DD"),
    end_date: str = Query(None, description="ISO format date YYYY-MM-DD"),
):
    """
    Get rider's earnings breakdown by period (daily/weekly/monthly).
    Returns daily/weekly/monthly breakdown with bonus calculations visible.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Parse dates
    if start_date:
        try:
            start = datetime.fromisoformat(start_date).date()
        except:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        if period == "daily":
            start = datetime.utcnow().date()
        elif period == "weekly":
            start = (datetime.utcnow() - timedelta(days=7)).date()
        else:  # monthly
            start = (datetime.utcnow() - timedelta(days=30)).date()

    if end_date:
        try:
            end = datetime.fromisoformat(end_date).date()
        except:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        end = datetime.utcnow().date()

    # Get earnings for the period
    earnings = db.query(RiderEarnings).filter(
        RiderEarnings.rider_id == rider.id,
        RiderEarnings.date >= datetime.combine(start, datetime.min.time()),
        RiderEarnings.date <= datetime.combine(end, datetime.max.time())
    ).order_by(RiderEarnings.date).all()

    # Group by period
    grouped = {}
    if period == "daily":
        for earning in earnings:
            day_key = earning.date.date().isoformat()
            if day_key not in grouped:
                grouped[day_key] = {
                    "date": day_key,
                    "base_fee": 0,
                    "distance_bonus": 0,
                    "speed_bonus": 0,
                    "rating_bonus": 0,
                    "total": 0,
                    "deliveries": 0
                }
            grouped[day_key]["base_fee"] += earning.base_fee
            grouped[day_key]["distance_bonus"] += earning.distance_bonus
            grouped[day_key]["speed_bonus"] += earning.speed_bonus
            grouped[day_key]["rating_bonus"] += earning.rating_bonus
            grouped[day_key]["total"] += earning.total_earned
            grouped[day_key]["deliveries"] += 1
    elif period == "weekly":
        for earning in earnings:
            week_num = earning.date.isocalendar()[1]
            year = earning.date.year
            week_key = f"{year}-W{week_num}"
            if week_key not in grouped:
                grouped[week_key] = {
                    "week": week_key,
                    "base_fee": 0,
                    "distance_bonus": 0,
                    "speed_bonus": 0,
                    "rating_bonus": 0,
                    "total": 0,
                    "deliveries": 0
                }
            grouped[week_key]["base_fee"] += earning.base_fee
            grouped[week_key]["distance_bonus"] += earning.distance_bonus
            grouped[week_key]["speed_bonus"] += earning.speed_bonus
            grouped[week_key]["rating_bonus"] += earning.rating_bonus
            grouped[week_key]["total"] += earning.total_earned
            grouped[week_key]["deliveries"] += 1
    else:  # monthly
        for earning in earnings:
            month_key = earning.date.strftime("%Y-%m")
            if month_key not in grouped:
                grouped[month_key] = {
                    "month": month_key,
                    "base_fee": 0,
                    "distance_bonus": 0,
                    "speed_bonus": 0,
                    "rating_bonus": 0,
                    "total": 0,
                    "deliveries": 0
                }
            grouped[month_key]["base_fee"] += earning.base_fee
            grouped[month_key]["distance_bonus"] += earning.distance_bonus
            grouped[month_key]["speed_bonus"] += earning.speed_bonus
            grouped[month_key]["rating_bonus"] += earning.rating_bonus
            grouped[month_key]["total"] += earning.total_earned
            grouped[month_key]["deliveries"] += 1

    # Calculate totals
    total_earned = sum(e.total_earned for e in earnings)
    total_deliveries = len(earnings)

    return {
        "period": period,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_earned": round(total_earned, 2),
        "total_deliveries": total_deliveries,
        "breakdown": list(grouped.values())
    }


@router.get("/me/performance")
def get_performance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get rider's performance metrics:
    - Completion rate (%)
    - Average rating (1-5)
    - Response time (avg minutes to accept)
    - On-time delivery percentage
    - Total deliveries
    - Customer ratings breakdown
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get all deliveries
    all_deliveries = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.rider_id == rider.id
    ).all()

    # Completion rate
    completed = sum(1 for d in all_deliveries if d.status == RiderDeliveryStatus.DELIVERED)
    total = len(all_deliveries)
    completion_rate = (completed / total * 100) if total > 0 else 0

    # Average rating
    ratings = [d.customer_rating for d in all_deliveries if d.customer_rating]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0

    # Response time (average minutes to accept delivery)
    # This would be calculated as time between assignment creation and pickup
    response_times = []
    for d in all_deliveries:
        if d.pickup_confirmed_at and d.created_at:
            response_min = (d.pickup_confirmed_at - d.created_at).total_seconds() / 60
            response_times.append(response_min)
    response_time_avg = sum(response_times) / len(response_times) if response_times else 0

    # On-time delivery (assuming anything delivered within 2 hours is on-time)
    on_time_count = 0
    for d in all_deliveries:
        if d.delivery_completed_at and d.created_at:
            delivery_time = (d.delivery_completed_at - d.created_at).total_seconds() / 3600
            if delivery_time <= 2:  # 2 hours
                on_time_count += 1
    on_time_percent = (on_time_count / completed * 100) if completed > 0 else 0

    # Rating breakdown
    rating_breakdown = {
        "5_star": sum(1 for r in ratings if r == 5),
        "4_star": sum(1 for r in ratings if r == 4),
        "3_star": sum(1 for r in ratings if r == 3),
        "2_star": sum(1 for r in ratings if r == 2),
        "1_star": sum(1 for r in ratings if r == 1),
    }

    return {
        "completion_rate_percent": round(completion_rate, 2),
        "average_rating": round(avg_rating, 2),
        "response_time_avg_minutes": round(response_time_avg, 2),
        "on_time_delivery_percent": round(on_time_percent, 2),
        "total_deliveries": total,
        "completed_deliveries": completed,
        "rating_breakdown": rating_breakdown,
        "total_ratings_received": len(ratings)
    }


@router.get("/me/delivery-history")
def get_delivery_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="Filter by delivery status"),
    start_date: str = Query(None, description="ISO format date YYYY-MM-DD"),
):
    """
    Get paginated list of completed deliveries for the rider.
    Each entry includes: date, pickup location, delivery location, earnings, rating, status
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Build query
    query = db.query(DeliveryAssignment).filter(
        DeliveryAssignment.rider_id == rider.id
    )

    # Apply filters
    if status:
        query = query.filter(DeliveryAssignment.status == status)
    else:
        # Default to completed deliveries
        query = query.filter(DeliveryAssignment.status == RiderDeliveryStatus.DELIVERED)

    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(DeliveryAssignment.delivery_completed_at >= start)
        except:
            pass

    # Order by most recent first
    query = query.order_by(DeliveryAssignment.delivery_completed_at.desc())
    total = query.count()

    # Pagination
    skip = (page - 1) * limit
    assignments = query.offset(skip).limit(limit).all()

    # Enrich with order details
    history = []
    for assignment in assignments:
        order = db.query(Order).filter(Order.id == assignment.order_id).first()
        earnings = db.query(RiderEarnings).filter(
            RiderEarnings.delivery_id == assignment.id
        ).first()

        if order:
            history.append({
                "delivery_id": assignment.id,
                "order_id": order.id,
                "pickup_location": order.seller_id,  # In real app, resolve to address
                "delivery_location": order.delivery_address,
                "earnings": assignment.final_earnings or (earnings.total_earned if earnings else 0),
                "rating": assignment.customer_rating or "Not rated",
                "status": assignment.status,
                "completed_at": assignment.delivery_completed_at.isoformat() if assignment.delivery_completed_at else None,
                "items_count": db.query(OrderItem).filter(OrderItem.order_id == order.id).count()
            })

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "history": history
    }


@router.post("/me/withdrawals")
def request_withdrawal(
    withdrawal_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Request a withdrawal of earnings.
    Validates minimum amount (KSh 500) and withdrawal method.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get request data
    amount = withdrawal_data.get("amount")
    method = withdrawal_data.get("method", "mpesa")  # mpesa or bank

    if not amount or amount < 500:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is KSh 500")

    if method not in ["mpesa", "bank"]:
        raise HTTPException(status_code=400, detail="Invalid withdrawal method. Use 'mpesa' or 'bank'")

    # Calculate available balance
    completed_earnings = db.query(RiderEarnings).filter(
        RiderEarnings.rider_id == rider.id
    ).all()
    total_balance = sum(e.total_earned for e in completed_earnings) if completed_earnings else 0

    # Get pending/completed withdrawals
    processed_withdrawals = db.query(RiderWithdrawal).filter(
        RiderWithdrawal.rider_id == rider.id,
        RiderWithdrawal.status.in_([WithdrawalStatus.PENDING, WithdrawalStatus.COMPLETED])
    ).all()
    withdrawn = sum(w.amount for w in processed_withdrawals)
    available_balance = total_balance - withdrawn

    if amount > available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: KSh {available_balance}"
        )

    # Create withdrawal request
    withdrawal = RiderWithdrawal(
        rider_id=rider.id,
        amount=amount,
        method=method,
        status=WithdrawalStatus.PENDING
    )
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)

    return {
        "success": True,
        "withdrawal_id": withdrawal.id,
        "amount": amount,
        "method": method,
        "status": withdrawal.status,
        "requested_date": withdrawal.requested_date.isoformat(),
        "available_balance_after": round(available_balance - amount, 2)
    }


@router.get("/me/withdrawals")
def get_withdrawal_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Get list of withdrawal requests for the rider.
    Shows status (pending, completed, rejected), amounts, dates, payment method.
    """
    # Get rider profile
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Get withdrawals
    query = db.query(RiderWithdrawal).filter(
        RiderWithdrawal.rider_id == rider.id
    ).order_by(RiderWithdrawal.requested_date.desc())

    total = query.count()

    # Pagination
    skip = (page - 1) * limit
    withdrawals = query.offset(skip).limit(limit).all()

    # Calculate available balance
    completed_earnings = db.query(RiderEarnings).filter(
        RiderEarnings.rider_id == rider.id
    ).all()
    total_balance = sum(e.total_earned for e in completed_earnings) if completed_earnings else 0

    processed_withdrawals = db.query(RiderWithdrawal).filter(
        RiderWithdrawal.rider_id == rider.id,
        RiderWithdrawal.status.in_([WithdrawalStatus.PENDING, WithdrawalStatus.COMPLETED])
    ).all()
    withdrawn = sum(w.amount for w in processed_withdrawals)
    available_balance = total_balance - withdrawn

    history = [
        {
            "withdrawal_id": w.id,
            "amount": w.amount,
            "method": w.method,
            "status": w.status,
            "requested_date": w.requested_date.isoformat(),
            "completed_date": w.completed_date.isoformat() if w.completed_date else None,
            "transaction_id": w.transaction_id,
            "reason_rejected": w.reason_rejected
        }
        for w in withdrawals
    ]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "available_balance": round(available_balance, 2),
        "total_earned": round(total_balance, 2),
        "withdrawals": history
    }


# ===================== SPRINT 4 ENDPOINTS =====================

@router.get("/me/profile")
def get_rider_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get complete rider profile with all details, documents, and banking info"""
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    return {
        "id": rider.id,
        "user_id": rider.user_id,
        "phone": rider.phone,
        "vehicle_type": rider.vehicle_type,
        "vehicle_plate": rider.vehicle_plate,
        "is_verified": rider.is_verified,
        "is_active": rider.is_active,
        "current_lat": rider.current_lat,
        "current_lng": rider.current_lng,
        "bank_account": rider.bank_account,
        "bank_name": rider.bank_name,
        "mpesa_number": rider.mpesa_number,
        "mpesa_verified": rider.mpesa_verified,
        "availability_status": rider.availability_status,
        "total_deliveries": rider.total_deliveries,
        "completed_deliveries": rider.completed_deliveries,
        "average_rating": rider.average_rating,
        "response_time_minutes": rider.response_time_minutes,
        "on_time_percentage": rider.on_time_percentage,
        "document_expiry": rider.document_expiry.isoformat() if rider.document_expiry else None,
        "created_at": rider.created_at.isoformat()
    }


@router.patch("/me/profile")
def update_rider_profile(
    profile_update: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update rider profile (bank account, M-Pesa, vehicle info, etc.)"""
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Allow updates to these fields only
    updatable_fields = [
        "bank_account", "bank_name", "mpesa_number",
        "vehicle_type", "vehicle_plate", "availability_status"
    ]

    for field in updatable_fields:
        if field in profile_update:
            setattr(rider, field, profile_update[field])

    db.add(rider)
    db.commit()
    db.refresh(rider)

    return {
        "success": True,
        "message": "Profile updated successfully",
        "profile": {
            "id": rider.id,
            "bank_account": rider.bank_account,
            "bank_name": rider.bank_name,
            "mpesa_number": rider.mpesa_number,
            "vehicle_type": rider.vehicle_type,
            "vehicle_plate": rider.vehicle_plate,
            "availability_status": rider.availability_status
        }
    }


@router.get("/me/documents-expiry")
def get_documents_expiry(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get document expiry status with alerts for documents expiring within 30 days"""
    from datetime import timedelta

    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    documents = []
    today = datetime.utcnow().date()
    expiry_date = rider.document_expiry.date() if rider.document_expiry else None

    if expiry_date:
        days_until_expiry = (expiry_date - today).days
        status = "valid"
        alert = None

        if days_until_expiry < 0:
            status = "expired"
            alert = f"Document expired {abs(days_until_expiry)} days ago"
        elif days_until_expiry < 30:
            status = "expiring_soon"
            alert = f"Document expires in {days_until_expiry} days"

        documents.append({
            "name": "Rider License/Document",
            "expiry_date": expiry_date.isoformat(),
            "status": status,
            "days_until_expiry": days_until_expiry,
            "alert": alert
        })
    else:
        documents.append({
            "name": "Rider License/Document",
            "expiry_date": None,
            "status": "not_uploaded",
            "days_until_expiry": None,
            "alert": "No document uploaded yet"
        })

    return {
        "documents": documents,
        "has_alerts": any(d["alert"] for d in documents)
    }


@router.post("/me/messages")
def send_message(
    message_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to a customer"""
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    recipient_id = message_data.get("recipient_id")
    message_text = message_data.get("message")

    if not recipient_id or not message_text:
        raise HTTPException(status_code=400, detail="Missing recipient_id or message")

    # In a full implementation, this would store in a Message model
    # For now, return success response
    return {
        "success": True,
        "message_id": str(uuid.uuid4()),
        "sender_id": rider.id,
        "recipient_id": recipient_id,
        "message": message_text,
        "sent_at": datetime.utcnow().isoformat(),
        "read": False
    }


@router.get("/me/messages")
def get_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get list of conversations/messages for the rider"""
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # In a full implementation, this would query a Message model
    # For now, return empty conversations
    return {
        "total": 0,
        "page": page,
        "limit": limit,
        "conversations": []
    }


@router.post("/{rider_id}/rate-customer")
def rate_customer(
    rider_id: str,
    rating_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a rating for a customer based on delivery experience"""
    # Verify it's the rider's own rating
    rider = db.query(Rider).filter(Rider.user_id == str(current_user.id)).first()
    if not rider or rider.id != rider_id:
        raise HTTPException(status_code=403, detail="Can only rate as yourself")

    delivery_id = rating_data.get("delivery_id")
    rating = rating_data.get("rating", 5)
    review = rating_data.get("review", "")

    if not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    # In a full implementation, would update DeliveryAssignment record
    # For now, return success
    return {
        "success": True,
        "message": "Customer rated successfully",
        "rider_id": rider_id,
        "delivery_id": delivery_id,
        "rating": rating,
        "review": review,
        "rated_at": datetime.utcnow().isoformat()
    }
