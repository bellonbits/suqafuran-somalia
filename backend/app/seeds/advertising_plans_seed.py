"""Seed data for advertising plans."""

from sqlmodel import Session
from app.models.advertising import AdvertisingPlan, PlacementType
from datetime import datetime


def seed_advertising_plans(db: Session) -> None:
    """Create default advertising plans if they don't exist."""

    plans = [
        AdvertisingPlan(
            name="Featured Product",
            placement_type=PlacementType.FEATURED_PRODUCT,
            description="Feature a product in search results and category listings",
            price_per_day=100.0,
            price_per_week=None,
            price_per_month=None,
            is_active=True,
        ),
        AdvertisingPlan(
            name="Featured Shop",
            placement_type=PlacementType.FEATURED_SHOP,
            description="Featured shop placement in the shops directory",
            price_per_day=None,
            price_per_week=1000.0,
            price_per_month=None,
            is_active=True,
        ),
        AdvertisingPlan(
            name="Category Featured",
            placement_type=PlacementType.CATEGORY_FEATURED,
            description="Featured placement in a specific product category",
            price_per_day=None,
            price_per_week=500.0,
            price_per_month=None,
            is_active=True,
        ),
    ]

    for plan in plans:
        # Check if plan already exists
        existing = db.query(AdvertisingPlan).filter(AdvertisingPlan.name == plan.name).first()
        if not existing:
            db.add(plan)
            print(f"✓ Created advertising plan: {plan.name}")

    db.commit()
