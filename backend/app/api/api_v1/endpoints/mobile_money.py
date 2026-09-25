import logging
import sys
import json
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, Body, HTTPException, Request
from sqlmodel import Session, select
from pydantic import BaseModel
from app.api import deps
from app.models.mobile_money import MobileTransaction
from app.models.promotion import Promotion, PromotionStatus
from app.services.payment_service import payment_service
from app.services.cache_service import cache
from app.services import lipana as lipana_service
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

class PaymentWebhookPayload(BaseModel):
    reference: str
    amount: float
    currency: Optional[str] = "KES"
    phone: str
    timestamp: Optional[datetime] = None

class StkPushRequest(BaseModel):
    phone: str
    amount: float

@router.post("/stk-push")
def initiate_stk_push(
    payload: StkPushRequest,
    current_user = Depends(deps.get_current_user),
) -> Any:
    """
    Initiate an M-Pesa STK Push for wallet top-up.
    """
    try:
        # Convert USD to KES for Lipana (assuming prices are in USD)
        # Note: If prices are already in KES, we can skip conversion.
        # But backend promotions.py uses USD and conversion.
        amount_kes = round(payload.amount * settings.KES_CONVERSION_RATE)
        
        logging.warning(f"!!! INITIATING WALLET STK PUSH: Phone={payload.phone}, USD={payload.amount}, KES={amount_kes}")
        
        result = lipana_service.initiate_stk_push(
            phone=payload.phone,
            amount=amount_kes,
            reference=f"Wallet {current_user.id}",
            description=f"Top-up User #{current_user.id}"
        )
        
        return result
    except Exception as exc:
        logging.error(f"STK push failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/webhook")
def receive_payment_webhook(
    payload: PaymentWebhookPayload,
    request: Request,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Receive payment notification from Mobile Money Provider.
    Idempotent: duplicate references within 24h are silently ignored.
    Requires the X-Webhook-Secret header to match MOBILE_MONEY_WEBHOOK_SECRET.
    """
    # Matched transactions activate paid promotions, so an unauthenticated
    # caller could fake a payment. Fail closed if no secret is configured.
    import hmac
    expected = settings.MOBILE_MONEY_WEBHOOK_SECRET
    provided = request.headers.get("X-Webhook-Secret", "")
    if not expected or not hmac.compare_digest(provided, expected):
        logger.warning("Mobile money webhook rejected: missing/invalid X-Webhook-Secret")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    # 1. Idempotency check — Redis-level guard (fast path)
    if cache.is_duplicate("mobile_webhook", payload.reference, ttl=86400):
        return {"status": "ignored", "detail": "Already processed"}

    # 2. DB-level guard — unique index on reference handles provider retries
    existing = db.query(MobileTransaction).filter(
        MobileTransaction.reference == payload.reference
    ).first()
    if existing:
        return {"status": "ignored", "detail": "Transaction already processed"}

    # 3. Create Transaction Record
    transaction = MobileTransaction(
        phone=payload.phone,
        amount=payload.amount,
        currency=payload.currency or "KES",
        reference=payload.reference,
        timestamp=payload.timestamp or datetime.utcnow(),
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    # 4. Attempt to Match
    matched_order = payment_service.match_transaction(db, transaction)

    return {
        "status": "success",
        "processed": True,
        "matched": bool(matched_order),
        "order_id": matched_order.id if matched_order else None
    }

@router.post("/lipana/webhook")
async def receive_lipana_webhook(
    request: Request,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Secure webhook for Lipana M-Pesa.
    Verifies X-Lipana-Signature and processes successful transactions.
    """
    from app.services.lipana import verify_webhook_signature
    
    # 1. Get raw body and signature
    raw_body = await request.body()
    signature = request.headers.get("X-Lipana-Signature") or ""
    
    # 2. Verify Signature
    if not verify_webhook_signature(raw_body, signature):
        logging.warning(f"!!! WEBHOOK ERROR: Invalid signature. Header: {signature}")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse Payload
    try:
        payload = json.loads(raw_body)
        logging.warning(f"!!! WEBHOOK RECEIVED: {json.dumps(payload, indent=1)}")
    except Exception as e:
        logging.warning(f"!!! WEBHOOK ERROR: JSON parse failed: {e}. Body: {raw_body}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # 4. Check Event Type
    event = payload.get("event")
    if event != "transaction.success":
        print(f"WEBHOOK IGNORED: Event is {event}", file=sys.stderr, flush=True)
        return {"status": "ignored", "reason": f"Event is {event}"}

    # 5. Extract Data (Official spec uses flat JSON with underscores)
    tx_id = payload.get("transaction_id")
    phone = payload.get("phone")
    amount = payload.get("amount")
    reference = payload.get("reference")

    if not all([tx_id, phone, amount]):
        # Fallback check for alternate/old formats if necessary
        data = payload.get("data", {})
        tx_id = tx_id or data.get("transaction_id") or data.get("transactionId")
        phone = phone or data.get("phone") or data.get("phoneNumber") or data.get("recipientPhone")
        amount = amount or data.get("amount")
        reference = reference or data.get("reference") or tx_id

    if not all([tx_id, phone, amount]):
        return {"status": "error", "message": "Missing required fields (transaction_id, phone, amount)"}

    # 6. Idempotency Guard (Redis)
    if cache.is_duplicate("lipana_webhook", tx_id, ttl=86400):
        return {"status": "ignored", "detail": "Already processed"}

    # 7. DB Guard (Duplicate check)
    existing = db.query(MobileTransaction).filter(
        MobileTransaction.reference == tx_id
    ).first()
    if existing:
        return {"status": "ignored", "detail": "Transaction already recorded"}

    # 8. Create internal transaction record
    transaction = MobileTransaction(
        phone=str(phone),
        amount=float(amount),
        currency="KES", # Lipana KES
        reference=tx_id,
        timestamp=datetime.utcnow(),
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    # 9. Trigger auto-matching
    logging.warning(f"!!! WEBHOOK MATCHING: Looking for Promo with lipana_tx_id={tx_id} or matching Phone={phone}, Amount={amount} or Reference={reference}")
    
    # Priority 0: Direct match by Lipana Transaction ID (from initiation response)
    matched_order = db.exec(
        select(Promotion).where(
            Promotion.lipana_tx_id == tx_id,
            Promotion.status == PromotionStatus.WAITING_FOR_PAYMENT
        )
    ).first()
    
    if matched_order:
        logging.warning(f"!!! WEBHOOK: Found direct match by lipana_tx_id={tx_id}")
        payment_service._activate_promotion(db, matched_order, transaction)

    # Priority 1: Direct match by "Promo X" reference
    if not matched_order and reference and str(reference).startswith("Promo "):
        try:
            promo_id_str = str(reference).replace("Promo ", "").strip()
            promo_id = int(promo_id_str)
            logging.warning(f"!!! WEBHOOK: Parsed Promo ID {promo_id} from reference {reference}")
            promo = db.get(Promotion, promo_id)
            if promo and promo.status == PromotionStatus.WAITING_FOR_PAYMENT:
                logging.warning(f"!!! WEBHOOK: Direct match found for Promo #{promo_id}")
                matched_order = promo
                # Use PaymentService to activate (handles listing boost etc)
                payment_service._activate_promotion(db, promo, transaction)
        except Exception as e:
            logging.warning(f"!!! WEBHOOK ERROR: Reference matching failed for {reference}: {e}")

    # Priority 2: Fallback to existing PaymentService logic (hex ID / Phone / Amount)
    if not matched_order:
        matched_order = payment_service.match_transaction(db, transaction)
    
    logging.warning(f"!!! WEBHOOK RESULT: {'SUCCESS - Matched Promo #' + str(matched_order.id) if matched_order else 'FAILED - No Match found'}")

    return {
        "status": "success",
        "transaction_id": tx_id,
        "matched": bool(matched_order)
    }

@router.post("/simulate")
def simulate_payment(
    payload: PaymentWebhookPayload,
    db: Session = Depends(deps.get_db),
    # current_user: User = Depends(deps.get_current_active_superuser), # Optional: restrict to admin?
) -> Any:
    """
    Dev Tool: Simulate a payment reception to test auto-matching.
    """
    # Add [SIM] prefix to reference if not present to avoid collisions
    if not payload.reference.startswith("SIM-"):
        payload.reference = f"SIM-{payload.reference}"
    
    return receive_payment_webhook(payload, db)
