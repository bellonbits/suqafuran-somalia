"""
Lipana M-Pesa payment gateway service.
Docs: https://api.lipana.dev/v1
"""
import hashlib
import hmac
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


LIPANA_BASE_URL = "https://api.lipana.dev/v1"


def initiate_stk_push(phone: str, amount: float, reference: str = "Promotion", description: str = "Suqafuran Ad Boost") -> dict:
    """
    Send an M-Pesa STK push prompt to the given phone number.
    Amount is in KES. Minimum amount is 10.
    Returns Lipana response dict with transactionId, checkoutRequestID.
    """
    # Normalize phone to 254... format
    clean_phone = phone.replace("+", "").replace(" ", "").strip()
    if clean_phone.startswith("0"):
        clean_phone = "254" + clean_phone[1:]
    elif (clean_phone.startswith("7") or clean_phone.startswith("1")) and len(clean_phone) == 9:
        clean_phone = "254" + clean_phone
    
    headers = {
        "x-api-key": settings.LIPANA_SECRET_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "phone": clean_phone,
        "amount": int(amount),  # Lipana expects integer KES
        "reference": reference,
        "description": description,
    }
    import sys
    import logging
    response = httpx.post(
        f"{LIPANA_BASE_URL}/transactions/push-stk",
        json=payload,
        headers=headers,
        timeout=30,
    )
    if response.status_code != 200:
        logging.warning(f"!!! LIPANA API ERROR {response.status_code}: {response.text}")
    else:
        logging.warning(f"!!! LIPANA API SUCCESS: {response.status_code}")
    response.raise_for_status()
    return response.json()


def verify_webhook_signature(payload_bytes: bytes, signature: str) -> bool:
    """
    Verify the X-Lipana-Signature header using HMAC-SHA256.
    Returns True if valid.
    """
    if not settings.LIPANA_WEBHOOK_SECRET or not signature:
        # Fail closed: without a secret (or a signature) we can't tell a real
        # Lipana callback from a forged one, and these activate paid features.
        logger.error("Lipana webhook rejected: LIPANA_WEBHOOK_SECRET not configured or signature missing")
        return False

    expected = hmac.new(
        settings.LIPANA_WEBHOOK_SECRET.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    try:
        return hmac.compare_digest(signature, expected)
    except Exception:
        return False
