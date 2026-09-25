import re
from typing import List, Dict, Any
from sqlmodel import Session, select, func
from app.models.listing import Listing
from app.models.user import User

def contains_phone_or_email(text: str) -> bool:
    """Detects phone numbers or emails in a text string."""
    phone_pattern = r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    return bool(re.search(phone_pattern, text)) or bool(re.search(email_pattern, text))

def get_category_median_price(category_id: int, db: Session) -> float:
    """Calculates the median price for a category in the last 30 days."""
    # Simplified version: just average for now
    prices = db.exec(
        select(Listing.price).where(Listing.category_id == category_id, Listing.status == "active")
    ).all()
    if not prices:
        return 0.0
    return sum(prices) / len(prices)

def calculate_listing_risk(listing_data: Dict[str, Any], seller: User, db: Session) -> int:
    """
    Calculates a risk score (0-100) for a new listing.
    """
    risk_score = 0
    title = listing_data.get('title_en', '') + ' ' + listing_data.get('title_so', '')
    description = listing_data.get('description_en', '') + ' ' + listing_data.get('description_so', '')
    price = listing_data.get('price', 0)
    category_id = listing_data.get('category_id')

    # 1. Price Anomaly
    if category_id:
        avg_price = get_category_median_price(category_id, db)
        if avg_price > 0:
            if price < (avg_price * 0.3): # Too low (Bait)
                risk_score += 40
            elif price > (avg_price * 3.0): # Too high
                risk_score += 25

    # 2. New Seller + High Value
    if seller.trust_score < 200 and price > 500:
        risk_score += 30

    # 3. Urgency Language
    urgency_words = ['urgent', 'asap', 'must sell', 'quick sale', 'act fast', 'deg deg']
    if any(word in (title + description).lower() for word in urgency_words):
        risk_score += 15

    # 4. Contact Info in Description
    if contains_phone_or_email(description):
        risk_score += 35

    return min(100, risk_score)
