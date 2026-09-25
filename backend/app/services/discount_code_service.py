"""
Discount Code Service - Marketing codes for sellers.
"""
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select
from app.models.subscription_features import DiscountCode
from app.core.logging_config import get_logger

logger = get_logger("discount_codes")


class DiscountCodeService:
    """Manage discount codes for sellers."""

    def create_discount_code(
        self,
        seller_id: int,
        code: str,
        discount_type: str,  # "percentage" or "fixed_amount"
        discount_value: float,  # 10 for 10%, 500 for KSh 500
        expiry_date: date,
        description: Optional[str] = None,
        max_uses: Optional[int] = None,
        min_purchase_amount: Optional[float] = None,
        session: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Create a new discount code for a seller."""

        # Validate discount type
        if discount_type not in ["percentage", "fixed_amount"]:
            raise ValueError(f"Invalid discount type: {discount_type}")

        # Validate values
        if discount_type == "percentage" and (discount_value < 0 or discount_value > 100):
            raise ValueError("Percentage discount must be between 0 and 100")

        if discount_type == "fixed_amount" and discount_value <= 0:
            raise ValueError("Fixed amount discount must be positive")

        # Check if code already exists
        existing = session.exec(
            select(DiscountCode).where(DiscountCode.code == code.upper())
        ).first()

        if existing:
            raise ValueError(f"Code {code} already exists")

        # Create code
        discount_code = DiscountCode(
            seller_id=seller_id,
            code=code.upper(),
            description=description,
            discount_type=discount_type,
            discount_value=discount_value,
            expiry_date=expiry_date,
            max_uses=max_uses,
            min_purchase_amount=min_purchase_amount,
            is_active=True,
        )

        session.add(discount_code)
        session.commit()
        session.refresh(discount_code)

        logger.info(f"Created discount code {code} for seller {seller_id}")

        return self._format_discount_code(discount_code)

    def use_discount_code(
        self,
        code: str,
        order_amount: float,
        session: Session,
    ) -> Dict[str, Any]:
        """
        Apply a discount code to an order.

        Returns discount amount if valid, raises error otherwise.
        """
        code = code.upper()

        # Find code
        discount = session.exec(
            select(DiscountCode).where(DiscountCode.code == code)
        ).first()

        if not discount:
            raise ValueError("Discount code not found")

        if not discount.is_active:
            raise ValueError("This discount code has been disabled")

        # Check expiry
        if discount.expiry_date < datetime.utcnow().date():
            raise ValueError("This discount code has expired")

        # Check usage limit
        if discount.max_uses and discount.current_uses >= discount.max_uses:
            raise ValueError("This discount code has reached its usage limit")

        # Check minimum purchase amount
        if discount.min_purchase_amount and order_amount < discount.min_purchase_amount:
            raise ValueError(
                f"Minimum purchase of KSh {discount.min_purchase_amount} required for this code"
            )

        # Calculate discount amount
        if discount.discount_type == "percentage":
            discount_amount = (order_amount * discount.discount_value) / 100
        else:  # fixed_amount
            discount_amount = min(discount.discount_value, order_amount)

        # Increment usage
        discount.current_uses += 1
        discount.revenue_generated += order_amount - discount_amount
        discount.updated_at = datetime.utcnow()

        session.add(discount)
        session.commit()

        logger.info(f"Used discount code {code}: KSh {discount_amount} off")

        return {
            "code": code,
            "discount_type": discount.discount_type,
            "discount_value": discount.discount_value,
            "discount_amount": round(discount_amount, 2),
            "final_amount": round(order_amount - discount_amount, 2),
            "uses_remaining": None if not discount.max_uses else max(0, discount.max_uses - discount.current_uses),
        }

    def get_seller_discount_codes(
        self,
        seller_id: int,
        active_only: bool = False,
        session: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """Get all discount codes for a seller."""
        query = select(DiscountCode).where(DiscountCode.seller_id == seller_id)

        if active_only:
            query = query.where(DiscountCode.is_active == True)

        codes = session.exec(query.order_by(DiscountCode.created_at.desc())).all()

        return [self._format_discount_code(code) for code in codes]

    def get_discount_code_analytics(
        self,
        code_id: int,
        session: Session,
    ) -> Dict[str, Any]:
        """Get performance analytics for a discount code."""
        code = session.exec(
            select(DiscountCode).where(DiscountCode.id == code_id)
        ).first()

        if not code:
            return None

        remaining_uses = None
        if code.max_uses:
            remaining_uses = max(0, code.max_uses - code.current_uses)

        return {
            "code": code.code,
            "description": code.description,
            "discount_type": code.discount_type,
            "discount_value": code.discount_value,
            "times_used": code.current_uses,
            "max_uses": code.max_uses,
            "remaining_uses": remaining_uses,
            "revenue_generated": code.revenue_generated,
            "expiry_date": code.expiry_date.isoformat(),
            "is_expired": code.expiry_date < datetime.utcnow().date(),
            "is_active": code.is_active,
            "status": "Active" if code.is_active and code.expiry_date >= datetime.utcnow().date() else "Inactive",
        }

    def disable_discount_code(
        self,
        code_id: int,
        seller_id: int,
        session: Session,
    ) -> bool:
        """Disable a discount code (soft delete)."""
        code = session.exec(
            select(DiscountCode).where(
                DiscountCode.id == code_id,
                DiscountCode.seller_id == seller_id,
            )
        ).first()

        if not code:
            logger.error(f"Code {code_id} not found or not owned by seller {seller_id}")
            return False

        code.is_active = False
        code.updated_at = datetime.utcnow()
        session.add(code)
        session.commit()

        logger.info(f"Disabled discount code {code.code}")
        return True

    def _format_discount_code(self, code: DiscountCode) -> Dict[str, Any]:
        """Format a discount code for API response."""
        remaining_uses = None
        if code.max_uses:
            remaining_uses = max(0, code.max_uses - code.current_uses)

        return {
            "id": code.id,
            "code": code.code,
            "description": code.description,
            "discount_type": code.discount_type,
            "discount_value": code.discount_value,
            "min_purchase_amount": code.min_purchase_amount,
            "times_used": code.current_uses,
            "max_uses": code.max_uses,
            "remaining_uses": remaining_uses,
            "revenue_generated": code.revenue_generated,
            "expiry_date": code.expiry_date.isoformat(),
            "is_expired": code.expiry_date < datetime.utcnow().date(),
            "is_active": code.is_active,
            "created_at": code.created_at.isoformat(),
        }


# Singleton instance
discount_code_service = DiscountCodeService()
