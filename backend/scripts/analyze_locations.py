#!/usr/bin/env python3
"""
Analyze existing locations in the database to see what shops are where.
Run this before the market migration to understand your data.

Usage:
    python scripts/analyze_locations.py
"""

from app.db.session import SessionLocal
from app.models.user import User
from sqlalchemy import func

def analyze_locations():
    """Analyze location distribution of shops in database."""
    db = SessionLocal()

    try:
        # Get all shops with locations
        shops_with_location = db.query(User).filter(
            User.business_name.isnot(None),
            User.location.isnot(None)
        ).all()

        # Get all shops without location
        shops_without_location = db.query(User).filter(
            User.business_name.isnot(None),
            User.location.is_(None)
        ).count()

        print("\n" + "="*70)
        print("📊 SHOP LOCATION ANALYSIS")
        print("="*70)

        print(f"\n📍 Total shops with location data: {len(shops_with_location)}")
        print(f"❌ Total shops WITHOUT location: {shops_without_location}")
        print(f"✓ Total shops: {len(shops_with_location) + shops_without_location}\n")

        # Group by location and show frequency
        location_counts = {}
        for shop in shops_with_location:
            loc = shop.location.strip().lower()
            location_counts[loc] = location_counts.get(loc, 0) + 1

        # Sort by frequency
        sorted_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)

        print("📍 LOCATION FREQUENCY (Top 40):")
        print("-" * 70)
        for i, (location, count) in enumerate(sorted_locations[:40], 1):
            print(f"{i:2d}. {location:40s} → {count:3d} shops")

        print("\n" + "="*70)
        print("ℹ️ Use this to improve the location-to-market mapping!")
        print("="*70 + "\n")

        # Show samples
        if sorted_locations:
            print("📝 SAMPLE SHOPS BY TOP 5 LOCATIONS:")
            print("-" * 70)
            for location, count in sorted_locations[:5]:
                samples = [s for s in shops_with_location if s.location.strip().lower() == location][:3]
                print(f"\n{location.upper()} ({count} shops)")
                for sample in samples:
                    print(f"  • {sample.business_name or 'No name'}")

    finally:
        db.close()


if __name__ == "__main__":
    analyze_locations()
