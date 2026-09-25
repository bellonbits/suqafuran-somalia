from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.api import deps
from app.crud import crud_user

router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])


class LocationUpdate(BaseModel):
    order_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


class OrderStatusUpdate(BaseModel):
    status: str  # pending, confirmed, packed, picked_up, in_transit, completed, cancelled
    notes: Optional[str] = None


class DeliveryResponse(BaseModel):
    order_id: str
    status: str
    rider_id: Optional[str]
    pickup_location: dict
    delivery_location: dict
    current_location: Optional[dict]
    estimated_time_remaining: Optional[int]
    distance_remaining: Optional[float]
    created_at: datetime
    updated_at: datetime


# In-memory storage for live tracking (use Redis in production)
live_deliveries = {}


@router.post("/accept/{order_id}")
def accept_delivery(
    order_id: str,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Rider accepts a delivery assignment"""
    if not current_user.get("is_rider"):
        raise HTTPException(status_code=403, detail="Only riders can accept deliveries")

    # In production, update database order
    if order_id not in live_deliveries:
        live_deliveries[order_id] = {
            "order_id": order_id,
            "status": "accepted",
            "rider_id": current_user.get("id"),
            "rider_name": current_user.get("full_name"),
            "rider_phone": current_user.get("phone"),
            "current_location": None,
            "accepted_at": datetime.utcnow(),
            "started_at": None,
            "completed_at": None,
        }

    return {
        "success": True,
        "message": f"Delivery {order_id} accepted",
        "rider_id": current_user.get("id"),
        "status": "accepted"
    }


@router.post("/status/{order_id}")
def update_delivery_status(
    order_id: str,
    status_update: OrderStatusUpdate,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Update order delivery status (rider or admin only)"""
    valid_statuses = [
        "pending", "confirmed", "packed", "picked_up",
        "in_transit", "completed", "cancelled"
    ]

    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    if order_id not in live_deliveries:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery = live_deliveries[order_id]
    old_status = delivery["status"]

    # Update status
    delivery["status"] = status_update.status
    delivery["updated_at"] = datetime.utcnow()

    if status_update.status == "in_transit":
        delivery["started_at"] = datetime.utcnow()
    elif status_update.status == "completed":
        delivery["completed_at"] = datetime.utcnow()

    if status_update.notes:
        delivery["notes"] = status_update.notes

    return {
        "success": True,
        "order_id": order_id,
        "previous_status": old_status,
        "current_status": status_update.status,
        "message": f"Order status updated from {old_status} to {status_update.status}",
        "updated_at": delivery["updated_at"]
    }


@router.post("/location/{order_id}")
def update_rider_location(
    order_id: str,
    location: LocationUpdate,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Update rider's live location for a delivery"""
    if not current_user.get("is_rider"):
        raise HTTPException(status_code=403, detail="Only riders can update location")

    if order_id not in live_deliveries:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery = live_deliveries[order_id]

    # Verify rider is assigned to this delivery
    if delivery.get("rider_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Not assigned to this delivery")

    # Update location
    delivery["current_location"] = {
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "timestamp": datetime.utcnow().isoformat()
    }

    return {
        "success": True,
        "order_id": order_id,
        "location_updated": True,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/{order_id}/location")
def get_delivery_location(
    order_id: str,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get current delivery location and status"""
    if order_id not in live_deliveries:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery = live_deliveries[order_id]

    return {
        "order_id": order_id,
        "status": delivery.get("status"),
        "rider": {
            "id": delivery.get("rider_id"),
            "name": delivery.get("rider_name"),
            "phone": delivery.get("rider_phone")
        },
        "current_location": delivery.get("current_location"),
        "pickup_location": {
            "lat": -1.286389,  # Mock data - replace with actual
            "lng": 36.817223
        },
        "delivery_location": {
            "lat": -1.290,  # Mock data - replace with actual
            "lng": 36.820
        },
        "timeline": {
            "accepted_at": delivery.get("accepted_at"),
            "started_at": delivery.get("started_at"),
            "completed_at": delivery.get("completed_at")
        },
        "last_updated": datetime.utcnow().isoformat()
    }


@router.get("/{order_id}/history")
def get_delivery_history(
    order_id: str,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Get delivery status history and timeline"""
    if order_id not in live_deliveries:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery = live_deliveries[order_id]

    history = []

    if delivery.get("accepted_at"):
        history.append({
            "status": "accepted",
            "timestamp": delivery["accepted_at"],
            "message": "Delivery accepted by rider"
        })

    if delivery.get("started_at"):
        history.append({
            "status": "in_transit",
            "timestamp": delivery["started_at"],
            "message": "Delivery in transit"
        })

    if delivery.get("completed_at"):
        history.append({
            "status": "completed",
            "timestamp": delivery["completed_at"],
            "message": "Delivery completed"
        })

    return {
        "order_id": order_id,
        "status": delivery.get("status"),
        "history": history,
        "current_location": delivery.get("current_location")
    }


@router.post("/{order_id}/complete")
def complete_delivery(
    order_id: str,
    completion_data: dict = None,
    current_user: dict = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """Mark delivery as completed and calculate earnings"""
    if not current_user.get("is_rider"):
        raise HTTPException(status_code=403, detail="Only riders can complete deliveries")

    if order_id not in live_deliveries:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery = live_deliveries[order_id]

    if delivery.get("rider_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Not assigned to this delivery")

    # Mark as completed
    delivery["status"] = "completed"
    delivery["completed_at"] = datetime.utcnow()

    # Calculate earnings (mock calculation)
    base_fee = 50  # KSh
    distance_bonus = 10  # KSh per km (estimate)
    time_bonus = 5  # KSh per minute (estimate)
    rating_bonus = 0  # Will be calculated after rating

    total_earnings = base_fee + distance_bonus + time_bonus

    return {
        "success": True,
        "order_id": order_id,
        "status": "completed",
        "completed_at": delivery["completed_at"],
        "earnings": {
            "base_fee": base_fee,
            "distance_bonus": distance_bonus,
            "time_bonus": time_bonus,
            "rating_bonus": rating_bonus,
            "total": total_earnings
        },
        "message": f"Delivery completed. Earned KSh {total_earnings}"
    }
