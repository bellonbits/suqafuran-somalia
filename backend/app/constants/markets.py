"""Kenyan markets database for shop location tracking."""

KENYAN_MARKETS = [
    # Nairobi Markets
    "Eastleigh Market",
    "Gikomba Market",
    "Kamukunji Market",
    "Muthurwa Market",
    "Toi Market",
    "Ngara Market",
    "City Market",
    "Kariobangi Market",
    "Kangemi Market",
    "Wakulima Market",
    "Kawangware Market",

    # Mombasa Markets
    "Kongowea Market (Mombasa)",
    "Marikiti Market (Mombasa)",

    # Kisumu Markets
    "Kibuye Market (Kisumu)",

    # Other Major Cities
    "Nakuru Market",
    "Eldoret Market",
    "Kitale Market",
    "Machakos Market",
    "Meru Market",
    "Garissa Market",

    # International Markets
    "Somali Market",
]

# Create a sorted version for UI dropdown
MARKETS_SORTED = sorted(KENYAN_MARKETS)

# Mapping of market to city for easier filtering
MARKET_TO_CITY = {
    # Nairobi
    "Eastleigh Market": "Nairobi",
    "Gikomba Market": "Nairobi",
    "Kamukunji Market": "Nairobi",
    "Muthurwa Market": "Nairobi",
    "Toi Market": "Nairobi",
    "Ngara Market": "Nairobi",
    "City Market": "Nairobi",
    "Kariobangi Market": "Nairobi",
    "Kangemi Market": "Nairobi",
    "Wakulima Market": "Nairobi",
    "Kawangware Market": "Nairobi",
    # Mombasa
    "Kongowea Market (Mombasa)": "Mombasa",
    "Marikiti Market (Mombasa)": "Mombasa",
    # Kisumu
    "Kibuye Market (Kisumu)": "Kisumu",
    # Other Kenya
    "Nakuru Market": "Nakuru",
    "Eldoret Market": "Eldoret",
    "Kitale Market": "Kitale",
    "Machakos Market": "Machakos",
    "Meru Market": "Meru",
    "Garissa Market": "Garissa",
    # International
    "Somali Market": "Somalia",
}

def get_markets_by_city(city: str) -> list:
    """Get all markets in a specific city."""
    return [market for market, market_city in MARKET_TO_CITY.items() if market_city == city]

def get_cities() -> list:
    """Get all unique cities with markets."""
    return sorted(set(MARKET_TO_CITY.values()))
