from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from utils.security import get_current_user
from models import User
from typing import Optional
from pydantic import BaseModel
import json

router = APIRouter(prefix="/addresses", tags=["addresses"])


class AddressCreate(BaseModel):
    label: str
    formatted_address: str
    lat: float
    lng: float
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    is_default: Optional[bool] = None


@router.get("/")
def list_addresses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's saved addresses"""
    try:
        if not current_user.addresses:
            return []

        addresses = json.loads(current_user.addresses) if isinstance(current_user.addresses, str) else current_user.addresses or []
        return addresses if isinstance(addresses, list) else []
    except Exception as e:
        return []


@router.post("/")
def create_address(
    payload: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new saved address"""
    try:
        addresses = json.loads(current_user.addresses) if isinstance(current_user.addresses, str) else current_user.addresses or []
        if not isinstance(addresses, list):
            addresses = []

        # Create new address with ID
        new_id = max([a.get("id", 0) for a in addresses], default=0) + 1
        new_address = {
            "id": new_id,
            "label": payload.label,
            "formatted_address": payload.formatted_address,
            "lat": payload.lat,
            "lng": payload.lng,
            "is_default": payload.is_default,
        }

        # Set as default if it's the first address or if explicitly set
        if not addresses or payload.is_default:
            for addr in addresses:
                addr["is_default"] = False
            new_address["is_default"] = True

        addresses.append(new_address)
        current_user.addresses = json.dumps(addresses)
        db.add(current_user)
        db.commit()

        return new_address
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{address_id}")
def update_address(
    address_id: int,
    payload: AddressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a saved address"""
    try:
        addresses = json.loads(current_user.addresses) if isinstance(current_user.addresses, str) else current_user.addresses or []
        if not isinstance(addresses, list):
            addresses = []

        address_found = False
        for addr in addresses:
            if addr.get("id") == address_id:
                if payload.label is not None:
                    addr["label"] = payload.label
                if payload.is_default is not None:
                    if payload.is_default:
                        for a in addresses:
                            a["is_default"] = False
                    addr["is_default"] = payload.is_default
                address_found = True
                break

        if not address_found:
            raise HTTPException(status_code=404, detail="Address not found")

        current_user.addresses = json.dumps(addresses)
        db.add(current_user)
        db.commit()

        for addr in addresses:
            if addr.get("id") == address_id:
                return addr

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{address_id}")
def delete_address(
    address_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a saved address"""
    try:
        addresses = json.loads(current_user.addresses) if isinstance(current_user.addresses, str) else current_user.addresses or []
        if not isinstance(addresses, list):
            addresses = []

        new_addresses = [addr for addr in addresses if addr.get("id") != address_id]

        if len(new_addresses) == len(addresses):
            raise HTTPException(status_code=404, detail="Address not found")

        if not any(a.get("is_default") for a in new_addresses) and new_addresses:
            new_addresses[0]["is_default"] = True

        current_user.addresses = json.dumps(new_addresses)
        db.add(current_user)
        db.commit()

        return {"message": "Address deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
