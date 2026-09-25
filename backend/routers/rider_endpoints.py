from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.api import deps

router = APIRouter(prefix="/api/v1/riders", tags=["riders"])


@router.get("/me/profile")
def get_rider_profile(
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get current rider profile"""
    return {
        "id": current_user.get("id"),
        "full_name": current_user.get("full_name"),
        "phone": current_user.get("phone"),
        "email": current_user.get("email"),
        "is_verified": current_user.get("is_verified", False),
        "vehicle_type": current_user.get("vehicle_type"),
        "vehicle_plate": current_user.get("vehicle_plate"),
        "created_at": datetime.utcnow().isoformat(),
    }


@router.get("/me/dashboard")
def get_rider_dashboard(
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get rider dashboard with earnings and stats"""
    return {
        "today_earnings": 1250.00,  # Mock data
        "deliveries_this_week": 8,
        "average_rating": 4.8,
        "completion_rate_percent": 98.5,
        "total_deliveries": 245,
        "next_delivery": {
            "destination": "123 Main St, Nairobi",
            "status": "pending",
            "estimated_distance": 3.2,
            "estimated_fee": 150.00
        },
        "availability_status": "online"
    }


@router.get("/me/available-deliveries")
def get_available_deliveries(
    max_distance: int = 50,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get available delivery assignments for rider"""
    return {
        "total": 12,
        "page": page,
        "limit": limit,
        "deliveries": [
            {
                "order_id": f"ORD_{i}",
                "delivery_address": f"Building {i}, {100+i*0.1}°E, 1.28°S",
                "distance_km": 2.5 + i * 0.5,
                "delivery_fee": 100 + i * 10,
                "items_count": 2 + (i % 3),
                "pickup_location": f"Shop {i}",
                "customer_rating": 4.5 + (i % 5) * 0.1,
                "total_amount": 500 + i * 50,
                "location": {
                    "lat": -1.286389 + i * 0.01,
                    "lng": 36.817223 + i * 0.01
                }
            }
            for i in range(1, min(limit + 1, 13))
        ]
    }


@router.post("/me/location")
def update_rider_location(
    latitude: float,
    longitude: float,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Update rider's GPS location"""
    return {
        "success": True,
        "message": "Location updated successfully",
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/me/documents-expiry")
def get_documents_expiry(
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get rider documents expiry status"""
    return {
        "documents": [
            {
                "name": "National ID",
                "status": "valid",
                "expiry_date": "2028-12-31",
                "alert": None
            },
            {
                "name": "Driving License",
                "status": "valid",
                "expiry_date": "2027-06-15",
                "alert": None
            },
            {
                "name": "Vehicle Insurance",
                "status": "expiring_soon",
                "expiry_date": "2026-08-10",
                "alert": "Expires in 2 months. Renew soon."
            }
        ],
        "has_alerts": True
    }


@router.get("/me/earnings")
def get_rider_earnings(
    period: str = "daily",
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get rider earnings breakdown"""
    if period == "daily":
        return {
            "period": "daily",
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "total_earnings": 1250.00,
            "breakdown": {
                "base_fees": 900.00,
                "distance_bonus": 250.00,
                "time_bonus": 100.00,
                "rating_bonus": 0.00
            },
            "deliveries_count": 8,
            "avg_per_delivery": 156.25
        }
    elif period == "weekly":
        return {
            "period": "weekly",
            "week": "2026-W27",
            "total_earnings": 8750.00,
            "breakdown": {
                "base_fees": 6000.00,
                "distance_bonus": 2000.00,
                "time_bonus": 700.00,
                "rating_bonus": 50.00
            },
            "deliveries_count": 52,
            "avg_per_delivery": 168.27
        }
    else:
        return {
            "period": "monthly",
            "month": "2026-07",
            "total_earnings": 35000.00,
            "breakdown": {
                "base_fees": 24000.00,
                "distance_bonus": 8000.00,
                "time_bonus": 2800.00,
                "rating_bonus": 200.00
            },
            "deliveries_count": 210,
            "avg_per_delivery": 166.67
        }


@router.get("/me/performance")
def get_rider_performance(
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get rider performance metrics"""
    return {
        "completion_rate": 98.5,
        "on_time_percentage": 95.2,
        "average_rating": 4.8,
        "total_deliveries": 245,
        "total_distance_km": 612.5,
        "ratings_breakdown": {
            "5_stars": 180,
            "4_stars": 50,
            "3_stars": 10,
            "2_stars": 3,
            "1_stars": 2
        },
        "customer_feedback": [
            "Professional and polite",
            "Fast delivery",
            "Great communication"
        ],
        "safety_score": 95,
        "milestones": {
            "deliveries_100": True,
            "deliveries_500": False,
            "rating_5_stars": True,
            "no_cancellations_30d": True
        }
    }


@router.post("/me/withdrawal-request")
def request_withdrawal(
    amount: float,
    method: str,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Request earnings withdrawal"""
    if amount < 500:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is KSh 500")

    return {
        "success": True,
        "withdrawal_id": f"WTH_{current_user.get('id')}_{datetime.utcnow().timestamp()}",
        "amount": amount,
        "method": method,
        "status": "pending",
        "estimated_arrival": "24-48 hours",
        "created_at": datetime.utcnow().isoformat()
    }
