"""Price alert endpoints for watching listings."""

from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.api import deps
from app.models.price_alert import PriceAlert, PriceAlertCreate, PriceAlertRead
from app.models.user import User
from app.models.listing import Listing
from app.crud.crud_price_alert import crud_price_alert

router = APIRouter()


@router.post("/watch", response_model=PriceAlertRead)
def watch_listing(
    *,
    db: Session = Depends(deps.get_db),
    alert_in: PriceAlertCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Start watching a listing for price drops.
    """
    listing = db.get(Listing, alert_in.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Check if already watching
    existing = crud_price_alert.get_watched(db, current_user.id, alert_in.listing_id)
    if existing:
        existing.is_active = True
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    alert = crud_price_alert.create(
        db,
        obj_in=alert_in.model_dump(),
        user_id=current_user.id,
    )

    return alert


@router.post("/unwatch/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def unwatch_listing(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    """
    Stop watching a listing.
    """
    alert = crud_price_alert.get_watched(db, current_user.id, listing_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Not watching this listing")

    alert.is_active = False
    db.add(alert)
    db.commit()


@router.get("/", response_model=List[PriceAlertRead])
def get_watched_listings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all listings user is watching.
    """
    return crud_price_alert.get_by_user(db, current_user.id)


@router.get("/my-alerts", response_model=List[PriceAlertRead])
def get_my_alerts(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all price alerts for current user.
    """
    return crud_price_alert.get_by_user(db, current_user.id)


@router.get("/{listing_id}/is-watching")
def is_watching(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Check if user is watching a listing.
    """
    alert = crud_price_alert.get_watched(db, current_user.id, listing_id)
    return {"is_watching": alert is not None}
