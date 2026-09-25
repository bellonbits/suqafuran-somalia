#!/usr/bin/env python3
"""
Fix miscategorized listings based on the analysis report.
"""
import os
import sys
sys.path.insert(0, '/Users/mac/suqafuran/backend')

from sqlmodel import Session, create_engine, select
from app.core.config import settings
from app.models.listing import Listing

# Create database engine
engine = create_engine(
    str(settings.DATABASE_URL),
    echo=False,
    connect_args={"sslmode": "require"} if "postgresql" in str(settings.DATABASE_URL) else {}
)

def fix_categories():
    """Fix miscategorized listings."""
    with Session(engine) as session:
        # Fix 1: Move bags/luggage from Beauty & Personal Care to Leisure & Sports
        # Items: 686 (suitcase), 685 (tactical bags), 684 (bags suitcase)
        # From: category_id=11, subcategory_id=79
        # To: category_id=13, subcategory_id=106 (Leisure & Sports → Training Bags)

        for item_id in [686, 685, 684]:
            listing = session.exec(select(Listing).where(Listing.id == item_id)).first()
            if listing:
                print(f"Fixing item {item_id}: {listing.title_en}")
                print(f"  Old: category_id={listing.category_id}, subcategory_id={listing.subcategory_id}")
                listing.category_id = 13
                listing.subcategory_id = 106
                session.add(listing)
                print(f"  New: category_id={listing.category_id}, subcategory_id={listing.subcategory_id}")

        # Fix 2: Assign missing subcategory for item 674 (shoes)
        # From: category_id=2, subcategory_id=NULL
        # To: category_id=2, subcategory_id=14 (Clothing & Shoes → Shoes)

        listing = session.exec(select(Listing).where(Listing.id == 674)).first()
        if listing:
            print(f"\nFixing item 674: {listing.title_en}")
            print(f"  Old: category_id={listing.category_id}, subcategory_id={listing.subcategory_id}")
            listing.subcategory_id = 14
            session.add(listing)
            print(f"  New: category_id={listing.category_id}, subcategory_id={listing.subcategory_id}")

        # Commit all changes
        session.commit()
        print("\n✅ All categories have been fixed!")

if __name__ == "__main__":
    try:
        fix_categories()
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)
