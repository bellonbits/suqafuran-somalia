"""
Discount Code Endpoints - Marketing codes for sellers.
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session

from app.db.session import get_db
from app.services.discount_code_service import discount_code_service
from app.api.deps import get_current_user
from app.core.logging_config import get_logger

logger = get_logger("discount_codes_api")

router = APIRouter(prefix="/discount-codes", tags=["discount-codes"])


# SELLER ENDPOINTS
@router.post("/sellers/{seller_id}/create")
async def create_discount_code(
    seller_id: int,
    code: str = Body(...),
    discount_type: str = Body(...),  # "percentage" or "fixed_amount"
    discount_value: float = Body(...),
    expiry_date: date = Body(...),
    description: str = Body(None),
    max_uses: int = Body(None),
    min_purchase_amount: float = Body(None),
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create a new discount code (Starter+ feature)."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        result = discount_code_service.create_discount_code(
            seller_id=seller_id,
            code=code,
            discount_type=discount_type,
            discount_value=discount_value,
            expiry_date=expiry_date,
            description=description,
            max_uses=max_uses,
            min_purchase_amount=min_purchase_amount,
            session=session,
        )

        return {
            "status": "success",
            "message": f"Discount code {code} created",
            "code": result,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating discount code: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create discount code")


@router.get("/sellers/{seller_id}/list")
async def list_discount_codes(
    seller_id: int,
    active_only: bool = False,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get all discount codes for a seller."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    codes = discount_code_service.get_seller_discount_codes(
        seller_id=seller_id,
        active_only=active_only,
        session=session,
    )

    return {
        "status": "success",
        "total": len(codes),
        "codes": codes,
    }


@router.get("/sellers/{seller_id}/code/{code_id}/analytics")
async def get_code_analytics(
    seller_id: int,
    code_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get performance analytics for a discount code."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    analytics = discount_code_service.get_discount_code_analytics(
        code_id=code_id,
        session=session,
    )

    if not analytics:
        raise HTTPException(status_code=404, detail="Discount code not found")

    return {
        "status": "success",
        "analytics": analytics,
    }


@router.post("/sellers/{seller_id}/code/{code_id}/disable")
async def disable_discount_code(
    seller_id: int,
    code_id: int,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Disable a discount code."""

    # Verify ownership
    if current_user.id != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    success = discount_code_service.disable_discount_code(
        code_id=code_id,
        seller_id=seller_id,
        session=session,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Discount code not found")

    return {
        "status": "success",
        "message": "Discount code disabled",
    }


# PUBLIC ENDPOINT - Apply discount code
@router.post("/apply")
async def apply_discount_code(
    code: str = Body(...),
    order_amount: float = Body(...),
    session: Session = Depends(get_db),
):
    """
    Apply a discount code to an order.

    This endpoint is public (no auth required) so customers can use codes.
    """
    try:
        result = discount_code_service.use_discount_code(
            code=code,
            order_amount=order_amount,
            session=session,
        )

        return {
            "status": "success",
            "discount": result,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error applying discount code: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to apply discount code")
