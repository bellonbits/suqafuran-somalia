"""
Promotion Code Generator Utility

Generates unique promotion codes in the format: YYYYMMDD-XXXXXX
"""

from datetime import datetime
import random
import string
from sqlmodel import Session

def generate_promotion_code(db: Session = None) -> str:
    """
    Generates a unique promotion code.
    Format: YYYYMMDD-XXXXXX (Date + Random String)
    """
    now = datetime.utcnow()
    date_str = now.strftime("%Y%m%d")
    
    # Generate random suffix
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=6))
    
    code = f"{date_str}-{suffix}"
    return code

def generate_voucher_code() -> str:
    """
    Generate a random 8-character alphanumeric voucher code.
    Format: XXXX-XXXX
    """
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" # No I, O, 0, 1 for clarity
    p1 = "".join(random.choice(chars) for _ in range(4))
    p2 = "".join(random.choice(chars) for _ in range(4))
    return f"{p1}-{p2}"
