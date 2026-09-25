from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api/v1/delivery", tags=["delivery"])


@router.get("/my/delivery")
def get_my_deliveries(limit: int = 10, offset: int = 0, status: str = None):
    """Get current rider's deliveries"""
    return {
        "total": 45,
        "limit": limit,
        "offset": offset,
        "deliveries": [
            {
                "order_id": f"ORD-{5000+i}",
                "customer_name": f"Customer {i}",
                "phone": f"0712345{67+i}",
                "pickup_location": f"Shop {i}, Nairobi",
                "delivery_address": f"{100+i} Main St, Nairobi",
                "items_count": 1 + (i % 3),
                "total_amount": 500 + i * 100,
                "delivery_fee": 150 + i * 10,
                "status": ["pending", "accepted", "picked_up", "in_transit", "completed"][i % 5],
                "distance_km": 2.5 + (i * 0.5),
                "estimated_time_mins": 15 + i * 2,
                "customer_rating": 4.5 + (i % 5) * 0.1,
                "special_instructions": "Handle with care" if i % 3 == 0 else None,
                "created_at": datetime.utcnow().isoformat()
            }
            for i in range(1, min(limit + 1, 46))
        ]
    }


@router.get("/my/earnings")
def get_my_earnings(period: str = "daily"):
    """Get rider's earnings for a period"""
    if period == "daily":
        return {
            "period": "daily",
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "total_earnings": 1250.00,
            "deliveries": 8,
            "breakdown": {"base_fees": 900.00, "distance_bonus": 250.00, "time_bonus": 100.00, "rating_bonus": 0.00},
            "avg_per_delivery": 156.25
        }
    elif period == "weekly":
        return {
            "period": "weekly",
            "week": "2026-W27",
            "total_earnings": 8750.00,
            "deliveries": 52,
            "breakdown": {"base_fees": 6000.00, "distance_bonus": 2000.00, "time_bonus": 700.00, "rating_bonus": 50.00},
            "avg_per_delivery": 168.27
        }
    else:
        return {
            "period": "monthly",
            "month": "2026-07",
            "total_earnings": 35000.00,
            "deliveries": 210,
            "breakdown": {"base_fees": 24000.00, "distance_bonus": 8000.00, "time_bonus": 2800.00, "rating_bonus": 200.00},
            "avg_per_delivery": 166.67
        }


@router.get("/my/stats")
def get_my_stats():
    """Get rider statistics"""
    return {
        "total_deliveries": 245,
        "completed_deliveries": 241,
        "cancelled_deliveries": 4,
        "average_rating": 4.8,
        "completion_rate": 98.5,
        "on_time_percentage": 95.2,
        "total_distance_km": 612.5,
        "total_earnings": 125640.00,
        "this_week_earnings": 8750.00,
        "this_week_deliveries": 52,
        "safety_score": 95,
        "customer_reviews": {"5_stars": 180, "4_stars": 50, "3_stars": 10, "2_stars": 3, "1_stars": 2}
    }


@router.post("/accept/{order_id}")
def accept_delivery(order_id: str):
    """Accept a delivery order"""
    return {
        "success": True,
        "message": f"Delivery {order_id} accepted",
        "order_id": order_id,
        "status": "accepted",
        "pickup_location": "123 Shop St, Nairobi",
        "delivery_address": "456 Customer Ave, Nairobi",
        "distance_km": 3.2,
        "estimated_time_mins": 18,
        "updated_at": datetime.utcnow().isoformat()
    }


@router.post("/update-status/{order_id}")
def update_delivery_status(order_id: str, status: str):
    """Update delivery status"""
    return {
        "success": True,
        "message": f"Delivery {order_id} status updated to {status}",
        "order_id": order_id,
        "status": status,
        "updated_at": datetime.utcnow().isoformat()
    }


@router.get("/{order_id}/location")
def get_delivery_location(order_id: str):
    """Get current delivery location"""
    return {
        "order_id": order_id,
        "rider_location": {"latitude": -1.286389, "longitude": 36.817223},
        "destination": {"latitude": -1.285389, "longitude": 36.825223},
        "distance_remaining_km": 0.8,
        "estimated_arrival_mins": 5,
        "status": "in_transit",
        "updated_at": datetime.utcnow().isoformat()
    }


@router.post("/complete/{order_id}")
def complete_delivery(order_id: str):
    """Mark delivery as completed"""
    return {
        "success": True,
        "message": f"Delivery {order_id} completed",
        "order_id": order_id,
        "status": "completed",
        "earnings": 165.00,
        "completed_at": datetime.utcnow().isoformat()
    }
