"""Admin endpoints for user lifecycle analytics."""

from typing import Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from pydantic import BaseModel

from app.api import deps
from app.models.user import User
from app.models.listing import Listing
from app.core.logging_config import get_logger

logger = get_logger("lifecycle_analytics")

router = APIRouter()


class ConversionRates(BaseModel):
    signup_to_profile: float
    profile_to_seller: float
    buyer_to_seller: float


class StageBreakdown(BaseModel):
    stage: str
    count: int
    percentage: float


class CohortData(BaseModel):
    cohort_month: str
    total_signups: int
    still_active: int
    retention_rate: float


class LifecycleStatsResponse(BaseModel):
    total_users: int
    signup: int
    profile_complete: int
    first_listing: int
    active_seller: int
    active_buyer: int
    inactive: int
    churn_rate: float
    avg_lifetime_days: float
    conversion_rates: ConversionRates
    stage_breakdown: list[StageBreakdown]
    cohort_data: list[CohortData]


def _check_admin_permission(current_user: User):
    """Verify user has admin permission."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view lifecycle analytics"
        )


@router.get("/stats", response_model=LifecycleStatsResponse)
def get_lifecycle_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get comprehensive user lifecycle analytics."""
    _check_admin_permission(current_user)

    try:
        # Get all active users
        all_users = db.exec(select(User).where(User.is_active == True)).all()
        total_users = len(all_users)

        # Get user IDs who have active listings (sellers)
        seller_ids = db.exec(
            select(func.distinct(Listing.owner_id)).where(
                Listing.approval_status == 'approved'
            )
        ).all()
        seller_ids_set = set(sid for sid in seller_ids if sid)

        # Count users by stage
        signup_count = total_users
        profile_complete = sum(1 for u in all_users if u.full_name)
        active_seller = sum(1 for u in all_users if u.id in seller_ids_set)
        active_buyer = sum(1 for u in all_users if u.id not in seller_ids_set and u.is_active)
        inactive = sum(1 for u in all_users if not u.is_active)

        # Users with at least one listing
        first_listing = db.exec(
            select(func.count(func.distinct(Listing.owner_id))).where(
                Listing.approval_status == 'approved'
            )
        ).first() or 0

        # Calculate churn rate (inactive in last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recently_churned = sum(
            1 for u in all_users
            if u.updated_at and u.updated_at < thirty_days_ago
        )
        churn_rate = (recently_churned / total_users * 100) if total_users > 0 else 0

        # Calculate average lifetime
        lifetimes = []
        for user in all_users:
            if user.created_at:
                lifetime = (datetime.utcnow() - user.created_at).days
                lifetimes.append(lifetime)

        avg_lifetime_days = sum(lifetimes) / len(lifetimes) if lifetimes else 0

        # Stage breakdown
        stage_breakdown = [
            StageBreakdown(
                stage="Signup",
                count=signup_count,
                percentage=100.0
            ),
            StageBreakdown(
                stage="Profile Complete",
                count=profile_complete,
                percentage=(profile_complete / signup_count * 100) if signup_count > 0 else 0
            ),
            StageBreakdown(
                stage="First Listing",
                count=first_listing,
                percentage=(first_listing / signup_count * 100) if signup_count > 0 else 0
            ),
            StageBreakdown(
                stage="Active Seller",
                count=active_seller,
                percentage=(active_seller / signup_count * 100) if signup_count > 0 else 0
            ),
            StageBreakdown(
                stage="Active Buyer",
                count=active_buyer,
                percentage=(active_buyer / signup_count * 100) if signup_count > 0 else 0
            ),
        ]

        # Conversion rates
        conversion_rates = ConversionRates(
            signup_to_profile=(profile_complete / signup_count * 100) if signup_count > 0 else 0,
            profile_to_seller=(active_seller / profile_complete * 100) if profile_complete > 0 else 0,
            buyer_to_seller=(active_seller / (active_buyer + active_seller) * 100) if (active_buyer + active_seller) > 0 else 0,
        )

        # Cohort retention (monthly)
        cohort_data = []
        for month_offset in range(6, -1, -1):
            cohort_date = datetime.utcnow() - timedelta(days=30*month_offset)
            cohort_start = cohort_date.replace(day=1)
            cohort_end = (cohort_start + timedelta(days=32)).replace(day=1)

            cohort_signups = db.exec(
                select(func.count(User.id)).where(
                    User.created_at >= cohort_start,
                    User.created_at < cohort_end
                )
            ).first() or 0

            if cohort_signups > 0:
                cohort_active = db.exec(
                    select(func.count(User.id)).where(
                        User.created_at >= cohort_start,
                        User.created_at < cohort_end,
                        User.is_active == True
                    )
                ).first() or 0

                retention = (cohort_active / cohort_signups * 100) if cohort_signups > 0 else 0

                cohort_data.append(CohortData(
                    cohort_month=cohort_start.strftime("%Y-%m"),
                    total_signups=cohort_signups,
                    still_active=cohort_active,
                    retention_rate=retention
                ))

        cohort_data.reverse()

        return LifecycleStatsResponse(
            total_users=total_users,
            signup=signup_count,
            profile_complete=profile_complete,
            first_listing=first_listing,
            active_seller=active_seller,
            active_buyer=active_buyer,
            inactive=inactive,
            churn_rate=churn_rate,
            avg_lifetime_days=int(avg_lifetime_days),
            conversion_rates=conversion_rates,
            stage_breakdown=stage_breakdown,
            cohort_data=cohort_data
        )

    except Exception as e:
        logger.error(f"Failed to get lifecycle stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate lifecycle statistics"
        )
