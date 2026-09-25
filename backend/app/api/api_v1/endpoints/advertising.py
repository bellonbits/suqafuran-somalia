from typing import Any, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.api import deps
from app.models.advertising import (
    AdvertisingPlan,
    Advertisement,
    AdvertisementStats,
    AdvertisementStatus,
    PlacementType,
)
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()


# ============================================================================
# Pydantic Schemas
# ============================================================================

class PlanResponse(BaseModel):
    id: int
    name: str
    placement_type: str
    description: str
    price_per_day: float | None
    price_per_week: float | None
    price_per_month: float | None


class CreatePaymentRequest(BaseModel):
    plan_id: int
    listing_id: int | None = None  # For featured products
    duration: int  # days or weeks depending on plan


class CreatePaymentResponse(BaseModel):
    checkout_request_id: str
    amount: float
    description: str
    advertisement_id: int


class AdvertisementResponse(BaseModel):
    id: int
    shop_id: int
    listing_id: int | None
    plan_id: int
    placement_type: str
    start_date: datetime
    end_date: datetime
    amount_paid: float
    status: str
    created_at: datetime
    updated_at: datetime


class AdvertisementDetailResponse(AdvertisementResponse):
    plan: PlanResponse | None = None
    stats: dict | None = None  # impressions, clicks, ctr


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/plans", response_model=List[PlanResponse])
def get_advertising_plans(
    *,
    db: Session = Depends(deps.get_db),
    placement_type: str | None = Query(None),
) -> Any:
    """
    Get available advertising plans.

    Optional filter by placement_type: featured_product, featured_shop, category_featured
    """
    query = select(AdvertisingPlan).where(AdvertisingPlan.is_active == True)

    if placement_type:
        query = query.where(AdvertisingPlan.placement_type == placement_type)

    plans = db.exec(query).all()
    return plans


@router.post("/create-payment", response_model=CreatePaymentResponse)
def create_payment(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    payment_in: CreatePaymentRequest,
) -> Any:
    """
    Create an advertisement and prepare M-Pesa payment.

    - Validates plan exists and is active
    - Calculates total price (backend, not frontend)
    - Creates advertisement record with PENDING_PAYMENT status
    - Returns M-Pesa payment details
    """
    # Validate plan
    plan = db.get(AdvertisingPlan, payment_in.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Advertising plan not found")

    # Validate listing (if needed)
    if payment_in.listing_id and plan.placement_type == PlacementType.FEATURED_PRODUCT:
        from app.crud import crud_listing
        listing = crud_listing.get_listing(db, id=payment_in.listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        if listing.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to feature this listing")

    # Seller must exist (already authenticated)

    # Calculate price (backend validation)
    price_per_unit = plan.price_per_day or plan.price_per_week or plan.price_per_month or 0
    if price_per_unit == 0:
        raise HTTPException(status_code=400, detail="Plan pricing not configured")

    total_price = price_per_unit * payment_in.duration

    # Calculate start and end dates
    start_date = datetime.utcnow()
    if plan.price_per_day:
        end_date = start_date + timedelta(days=payment_in.duration)
    elif plan.price_per_week:
        end_date = start_date + timedelta(weeks=payment_in.duration)
    else:
        end_date = start_date + timedelta(days=30 * payment_in.duration)

    # Create advertisement record
    advertisement = Advertisement(
        seller_id=current_user.id,
        listing_id=payment_in.listing_id,
        plan_id=payment_in.plan_id,
        placement_type=plan.placement_type,
        start_date=start_date,
        end_date=end_date,
        amount_paid=total_price,
        payment_reference="",  # Will be filled by M-Pesa callback
        status=AdvertisementStatus.PENDING_PAYMENT,
    )

    db.add(advertisement)
    db.commit()
    db.refresh(advertisement)

    # Create stats record
    stats = AdvertisementStats(advertisement_id=advertisement.id)
    db.add(stats)
    db.commit()

    # TODO: Integrate with M-Pesa service to create STK push
    # For now, return mock response
    checkout_request_id = f"ADV_{advertisement.id}_{datetime.utcnow().timestamp()}"

    return CreatePaymentResponse(
        checkout_request_id=checkout_request_id,
        amount=total_price,
        description=f"{plan.name} - {payment_in.duration} {'day' if plan.price_per_day else 'week' if plan.price_per_week else 'month'}(s)",
        advertisement_id=advertisement.id,
    )


@router.get("/my-ads", response_model=List[AdvertisementDetailResponse])
def get_seller_advertisements(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    status: str | None = Query(None),
) -> Any:
    """
    Get all advertisements for the current seller.
    """
    # Query advertisements for current seller
    query = select(Advertisement).where(Advertisement.seller_id == current_user.id)

    if status:
        query = query.where(Advertisement.status == status)

    query = query.order_by(Advertisement.created_at.desc())
    ads = db.exec(query).all()

    # Enrich with plan and stats
    result = []
    for ad in ads:
        plan = db.get(AdvertisingPlan, ad.plan_id)
        stats = db.exec(select(AdvertisementStats).where(AdvertisementStats.advertisement_id == ad.id)).first()

        ctr = 0.0
        if stats and stats.impressions > 0:
            ctr = (stats.clicks / stats.impressions) * 100

        result.append(AdvertisementDetailResponse(
            **ad.dict(),
            plan=PlanResponse(**plan.dict()) if plan else None,
            stats={
                "impressions": stats.impressions if stats else 0,
                "clicks": stats.clicks if stats else 0,
                "ctr": ctr,
            },
        ))

    return result


@router.get("/{ad_id}", response_model=AdvertisementDetailResponse)
def get_advertisement(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    ad_id: int,
) -> Any:
    """
    Get details of a specific advertisement.
    """
    ad = db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")

    # Verify ownership
    if ad.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this advertisement")

    plan = db.get(AdvertisingPlan, ad.plan_id)
    stats = db.exec(select(AdvertisementStats).where(AdvertisementStats.advertisement_id == ad.id)).first()

    ctr = 0.0
    if stats and stats.impressions > 0:
        ctr = (stats.clicks / stats.impressions) * 100

    return AdvertisementDetailResponse(
        **ad.dict(),
        plan=PlanResponse(**plan.dict()) if plan else None,
        stats={
            "impressions": stats.impressions if stats else 0,
            "clicks": stats.clicks if stats else 0,
            "ctr": ctr,
        },
    )


@router.patch("/{ad_id}/cancel", response_model=dict)
def cancel_advertisement(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    ad_id: int,
) -> Any:
    """
    Cancel an active advertisement (refund not implemented yet).
    """
    ad = db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")

    # Verify ownership
    if ad.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this advertisement")

    if ad.status in [AdvertisementStatus.EXPIRED, AdvertisementStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot cancel an expired or already cancelled advertisement")

    ad.status = AdvertisementStatus.CANCELLED
    ad.updated_at = datetime.utcnow()
    db.add(ad)
    db.commit()

    return {"message": "Advertisement cancelled successfully"}
