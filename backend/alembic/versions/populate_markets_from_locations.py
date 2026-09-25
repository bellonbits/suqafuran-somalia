"""Populate market field from existing location data.

Automatically assigns Kenyan markets based on user locations.
Defaults to Eastleigh Market for shops without location data.

Revision ID: market_002
Revises: market_001
Create Date: 2026-07-17 11:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision = 'market_002'
down_revision = 'market_001'
branch_labels = None
depends_on = None

# Location to Market mapping
# Based on actual database analysis:
# - 187/221 shops (84.6%) have NO location data → default to Eastleigh Market
# - 22 shops from "nairobi" → Eastleigh Market
# - 4 shops from "garoowe" (Somalia) → Somali Market
# - 2 shops from "garowe" (Somalia variant) → Somali Market
# - 1 shop from "somalia" → Somali Market
# - Result: Kenya shops → Eastleigh/local markets, Somalia shops → Somali Market

LOCATION_TO_MARKET = {
    # Kenyan Markets
    'eastleigh': 'Eastleigh Market',
    'gikomba': 'Gikomba Market',
    'kamukunji': 'Kamukunji Market',
    'muthurwa': 'Muthurwa Market',
    'toi': 'Toi Market',
    'ngara': 'Ngara Market',
    'city market': 'City Market',
    'city centre': 'City Market',
    'cbd': 'City Market',
    'kariobangi': 'Kariobangi Market',
    'kangemi': 'Kangemi Market',
    'wakulima': 'Wakulima Market',
    'kawangware': 'Kawangware Market',
    'mombasa': 'Kongowea Market (Mombasa)',
    'kongowea': 'Kongowea Market (Mombasa)',
    'marikiti': 'Marikiti Market (Mombasa)',
    'kisumu': 'Kibuye Market (Kisumu)',
    'kibuye': 'Kibuye Market (Kisumu)',
    'nakuru': 'Nakuru Market',
    'eldoret': 'Eldoret Market',
    'kitale': 'Kitale Market',
    'machakos': 'Machakos Market',
    'meru': 'Meru Market',
    'garissa': 'Garissa Market',
    'nairobi': 'Eastleigh Market',

    # Nairobi Suburbs
    'westlands': 'Eastleigh Market',
    'karen': 'Eastleigh Market',
    'ngong': 'Eastleigh Market',
    'buruburu': 'Eastleigh Market',
    'northridge': 'Eastleigh Market',
    'kilimani': 'Eastleigh Market',
    'langata': 'Eastleigh Market',
    'muthaiga': 'Eastleigh Market',
    'lavington': 'Eastleigh Market',
    'groganville': 'Eastleigh Market',
    'ridgeways': 'Eastleigh Market',

    # Non-Kenya locations (Somalia, etc) → Somali Market
    'garoowe': 'Somali Market',     # Somalia
    'garowe': 'Somali Market',      # Somalia variant
    'somalia': 'Somali Market',
}

def get_market_from_location(location: str) -> str:
    """Infer market from location string. Defaults to Eastleigh Market."""
    if not location:
        return 'Eastleigh Market'

    location_lower = location.lower().strip()

    # Try exact and partial matches
    for key, market in LOCATION_TO_MARKET.items():
        if key in location_lower or location_lower == key:
            return market

    # Check if location starts with a market keyword
    for key, market in LOCATION_TO_MARKET.items():
        if location_lower.startswith(key):
            return market

    # Default to Eastleigh Market for unknown locations
    return 'Eastleigh Market'


def upgrade() -> None:
    # Get connection
    conn = op.get_bind()

    # Fetch all users with business names (sellers/shops)
    query = sa.text("""
        SELECT id, location, business_name
        FROM "user"
        WHERE business_name IS NOT NULL AND (market IS NULL OR market = '')
        LIMIT 5000
    """)

    users = conn.execute(query).fetchall()

    # Update each user with appropriate market
    for user_id, location, business_name in users:
        market = get_market_from_location(location)

        update_query = sa.text("""
            UPDATE "user"
            SET market = :market
            WHERE id = :id
        """)

        conn.execute(update_query, {"market": market, "id": user_id})

    conn.commit()
    print(f"✓ Updated {len(users)} shops with market locations")
    print(f"✓ Default market: Eastleigh Market")


def downgrade() -> None:
    # Optionally clear markets on rollback
    # For now, just leave them as-is since it's safe data
    print("⚠ Note: Market data will remain; manually clear if needed")
