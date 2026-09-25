from datetime import datetime, timedelta
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from app.api import deps
from app.models.promotion import Promotion, PromotionPlan, PromotionStatus, PromotionCode, PromotionCodeStatus
from app.models.listing import Listing
from app.models.wallet import Voucher
from app.models.mobile_money import MobileTransaction
from app.models.audit import AuditLog
from app.utils.code_generator import generate_promotion_code, generate_voucher_code
from app.services import lipana as lipana_service
from app.core.config import settings
from pydantic import BaseModel
import logging
import sys
import json

logger = logging.getLogger(__name__)

router = APIRouter()

class PromotionCreateIn(BaseModel):
    listing_id: int
    plan_id: int
    payment_phone: str # The phone number the user will pay from

class PromotionSubmitIn(BaseModel):
    payment_proof: str # Transaction ID or reference

class PromotionApproveIn(BaseModel):
    plan_id: int  # Admin selects the promotion type

class PromotionRejectIn(BaseModel):
    reason: str

class PromotionCodeApplyIn(BaseModel):
    code: str
    listing_id: int
    plan_id: int

class VoucherGenerateIn(BaseModel):
    amount: float = 0.0

@router.get("/plans", response_model=List[PromotionPlan])
def get_plans(db: Session = Depends(deps.get_db)) -> Any:
    return db.exec(select(PromotionPlan)).all()

@router.post("/", response_model=Promotion)
def create_promotion_request(
    payload: PromotionCreateIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    # Get plan details for the amount
    plan = db.get(PromotionPlan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Promotion plan not found")

    promo = Promotion(
        listing_id=payload.listing_id,
        plan_id=payload.plan_id,
        status=PromotionStatus.WAITING_FOR_PAYMENT,
        payment_phone=payload.payment_phone,
        amount=plan.price_usd
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)

    # 🔥 Fire Lipana STK push immediately
    listing = db.get(Listing, payload.listing_id)
    listing_title = listing.title_en if listing else "Ad Boost"
    
    try:
        # Convert USD to KES for Lipana
        amount_kes = round(plan.price_usd * settings.KES_CONVERSION_RATE)
        logging.warning(f"!!! INITIATING STK PUSH: Phone={payload.payment_phone}, USD={plan.price_usd}, KES={amount_kes}")
        
        result = lipana_service.initiate_stk_push(
            phone=payload.payment_phone,
            amount=amount_kes,
            reference=f"Promo {promo.id}",
            description=f"Boost: {listing_title}"
        )
        logging.warning(f"!!! LIPANA STK PUSH RESPONSE: {json.dumps(result, indent=1)}")
        
        data = result.get("data", result)
        lipana_tx_id = data.get("transactionId") or data.get("transaction_id")
        
        if lipana_tx_id:
            promo.lipana_tx_id = lipana_tx_id
            db.add(promo)
            db.commit()
            db.refresh(promo)
            logging.warning(f"!!! PROMO #{promo.id} SAVED lipana_tx_id={lipana_tx_id}")
        else:
            logging.warning(f"!!! PROMO #{promo.id} ERROR: No transactionId found in Lipana response")
            # For now, let's Raise so the user knows it failed
            raise HTTPException(status_code=400, detail=f"Lipana Error: No transaction ID returned. {result}")
            
    except HTTPException:
        raise
    except Exception as exc:
        logging.warning(f"!!! Lipana STK push failed for promo {promo.id}: {exc}")
        # Throw the error back to the frontend so they see what happened
        raise HTTPException(status_code=400, detail=f"Failed to trigger M-Pesa prompt: {str(exc)}")

    return promo


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC WEBHOOK — called by Lipana when payment succeeds
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/webhook", include_in_schema=False)
async def lipana_webhook(
    request: Request,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Receive Lipana payment.success events and auto-activate the promotion. Idempotent."""
    from app.services.cache_service import cache

    raw_body = await request.body()

    # Signature is mandatory -- skipping the check when the header was absent
    # let anyone forge a payment.success event by leaving it out.
    signature = request.headers.get("X-Lipana-Signature", "")
    if not lipana_service.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event")
    data = payload.get("data", {})

    if event not in ("payment.success", "transaction.success"):
        return {"received": True, "action": "ignored"}

    lipana_tx_id = (
        data.get("transactionId")
        or data.get("transaction_id")
        or data.get("checkoutRequestID")
    )
    if not lipana_tx_id:
        return {"received": True, "action": "no_txn_id"}

    # ── Idempotency guard ──────────────────────────────────────────────────
    # Redis fast-path: if this tx was already processed in the last 24h, skip
    if cache.is_duplicate("lipana_webhook", lipana_tx_id, ttl=86400):
        logger.info(f"Lipana webhook duplicate ignored: {lipana_tx_id}")
        return {"received": True, "action": "duplicate_ignored"}

    # Find the promotion that matches this Lipana transaction
    promo = db.exec(
        select(Promotion).where(Promotion.lipana_tx_id == lipana_tx_id)
    ).first()

    if not promo:
        logger.warning(f"Lipana webhook: no promotion found for tx {lipana_tx_id}")
        return {"received": True, "action": "promo_not_found"}

    if promo.status in (PromotionStatus.PAID, PromotionStatus.APPROVED):
        return {"received": True, "action": "already_active"}

    # Auto-activate the promotion
    activate_promotion(db, promo, matched_transaction_ref=lipana_tx_id)

    # Audit log
    listing = db.get(Listing, promo.listing_id)
    actor_id = listing.owner_id if listing else 0
    log = AuditLog(
        user_id=actor_id,
        action="LIPANA_PAYMENT",
        resource_type="promotion",
        resource_id=promo.id,
        details=f"Lipana payment confirmed for promo #{promo.id} (tx: {lipana_tx_id}). Promotion auto-activated."
    )
    db.add(log)
    db.commit()

    logger.info(f"Promotion #{promo.id} auto-activated via Lipana webhook (tx: {lipana_tx_id})")
    return {"received": True, "action": "activated", "promo_id": promo.id}


@router.get("/{promo_id}/diag")
def debug_payment_matching(
    promo_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """Diagnostic endpoint to see why a payment isn't matching."""
    promo = db.get(Promotion, promo_id)
    if not promo:
        return {"error": "Promotion not found"}
    
    # Check ownership or admin
    if not current_user.is_superuser:
        listing = db.get(Listing, promo.listing_id)
        if listing and listing.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
    # Check all transactions for this phone or amount
    clean_phone = "".join(filter(str.isdigit, promo.payment_phone)) if promo.payment_phone else ""
    
    statement = select(MobileTransaction).where(
        (MobileTransaction.amount == promo.amount) | 
        (MobileTransaction.phone.contains(clean_phone if clean_phone else "NONE"))
    ).order_by(MobileTransaction.timestamp.desc())
    
    transactions = db.exec(statement).all()
    
    return {
        "promotion": {
            "id": promo.id,
            "status": promo.status,
            "amount": promo.amount,
            "payment_phone": promo.payment_phone,
            "lipana_tx_id": promo.lipana_tx_id,
            "created_at": promo.created_at
        },
        "matching_candidate_transactions": [
            {
                "id": t.id,
                "phone": t.phone,
                "amount": t.amount,
                "reference": t.reference,
                "is_linked": t.is_linked,
                "linked_promotion_id": t.linked_promotion_id,
                "timestamp": t.timestamp
            } for t in transactions
        ]
    }

@router.post("/{promo_id}/check-payment")
def check_promotion_payment(
    promo_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    """
    Automatically detect mobile money payment for a promotion request.
    Matches by: Phone Number, Amount, and Time (within last 30 mins).
    """
    promo = db.get(Promotion, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion request not found")
    
    logging.warning(f"!!! POLLING: Checking Promo #{promo.id}, Status={promo.status}, Phone={promo.payment_phone}, Amount={promo.amount}, LipanaID={promo.lipana_tx_id}")

    if promo.status in (PromotionStatus.APPROVED, PromotionStatus.PAID, "approved", "paid", "APPROVED", "PAID"):
        logging.warning(f"!!! POLLING: Promo #{promo.id} is ALREADY ACTIVE. Status={promo.status}")
        return {"status": "APPROVED", "message": "Promotion already paid/active"}

    # Time window: last 120 minutes (be generous for debugging)
    time_window = datetime.utcnow() - timedelta(minutes=120)
    
    # Priority 1: Search by exact Lipana Transaction ID if we have it
    match = None
    if promo.lipana_tx_id:
        logging.warning(f"!!! POLLING: Searching for exact match for Lipana ID: {promo.lipana_tx_id}")
        statement = select(MobileTransaction).where(
            MobileTransaction.reference == promo.lipana_tx_id,
            MobileTransaction.is_linked == False
        )
        match = db.exec(statement).first()
        if match:
             logging.warning(f"!!! POLLING: Found EXACT match by Lipana ID: {promo.lipana_tx_id}")
    
    # Priority 2: Fuzzy search (Phone + Amount)
    if not match:
        # Search for matching mobile transaction
        # We strip any non-digit chars from phone for matching
        clean_phone = "".join(filter(str.isdigit, promo.payment_phone)) if promo.payment_phone else ""
        
        statement = select(MobileTransaction).where(
            MobileTransaction.amount == promo.amount,
            MobileTransaction.is_linked == False,
            MobileTransaction.timestamp >= time_window
        )
        transactions = db.exec(statement).all()
        logging.warning(f"!!! POLLING: Found {len(transactions)} candidate transactions for amount {promo.amount}")
        
        # Filter by phone (inexact match for regional formats)
        for tx in transactions:
            tx_clean_phone = "".join(filter(str.isdigit, tx.phone))
            logging.warning(f"!!! POLLING: Comparing {clean_phone} with {tx_clean_phone}")
            if clean_phone and (clean_phone in tx_clean_phone or tx_clean_phone in clean_phone):
                match = tx
                logging.warning(f"!!! POLLING: Found FUZZY match by phone: {tx.phone}")
                break
            
    if not match:
        logging.warning(f"!!! POLLING: No match found for Promo #{promo.id}")
        return {"status": promo.status, "message": "No matching payment detected yet. Please ensure you have paid."}

    # Match found! Link and activate
    logging.warning(f"!!! POLLING SUCCESS: Match found! Activating Promo #{promo.id} via match {match.reference}")
    match.is_linked = True
    match.linked_promotion_id = promo.id
    db.add(match)
    
    activate_promotion(db, promo, matched_transaction_ref=match.reference)
    
    return {
        "status": "APPROVED",
        "message": "Payment detected! Promotion is now active.",
        "expires_at": promo.expires_at
    }

class PromotionRead(Promotion):
    listing_title_en: Optional[str] = None
    listing_title_so: Optional[str] = None
    plan_name_en: Optional[str] = None
    plan_name_so: Optional[str] = None

# ===== AGENT PORTAL ENDPOINTS =====

@router.get("/agent/payment-queue", response_model=List[MobileTransaction])
def get_payment_queue(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user)
) -> Any:
    """Agent-only: View unmatched and non-rejected mobile transactions"""
    return db.exec(
        select(MobileTransaction)
        .where(MobileTransaction.is_linked == False)
        .where(MobileTransaction.is_rejected == False)
        .order_by(MobileTransaction.timestamp.desc())
    ).all()

@router.post("/agent/transactions/{tx_id}/reject")
def reject_transaction(
    tx_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user)
) -> Any:
    """Agent-only: Mark a mobile transaction as rejected/ignored"""
    tx = db.get(MobileTransaction, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    tx.is_rejected = True
    db.add(tx)
    
    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="REJECT_TRANSACTION",
        resource_type="mobile_transaction",
        resource_id=tx.id,
        details=f"Agent rejected transaction {tx.reference} ({tx.amount} {tx.currency})"
    )
    db.add(log)
    db.commit()
    
    return {"success": True, "message": "Transaction rejected."}

@router.get("/agent/pending-orders", response_model=List[PromotionRead])
def get_pending_orders(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user)
) -> Any:
    """Agent-only: View orders waiting for payment or pending matching"""
    statement = (
        select(
            Promotion, 
            Listing.title_en.label("listing_title_en"), 
            Listing.title_so.label("listing_title_so"),
            PromotionPlan.name_en.label("plan_name_en"),
            PromotionPlan.name_so.label("plan_name_so")
        )
        .join(Listing, Promotion.listing_id == Listing.id)
        .join(PromotionPlan, Promotion.plan_id == PromotionPlan.id)
        .where(Promotion.status.in_([PromotionStatus.WAITING_FOR_PAYMENT, PromotionStatus.PENDING]))
    )
    results = db.exec(statement).all()
    
    promotions = []
    for promo, lt_en, lt_so, pn_en, pn_so in results:
        p_dict = promo.model_dump()
        p_dict["listing_title_en"] = lt_en
        p_dict["listing_title_so"] = lt_so
        p_dict["plan_name_en"] = pn_en
        p_dict["plan_name_so"] = pn_so
        promotions.append(PromotionRead(**p_dict))
    return promotions

@router.get("/agent/history", response_model=List[PromotionRead])
def get_agent_history(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user),
    limit: int = 50
) -> Any:
    """Agent-only: View recently activated promotions"""
    statement = (
        select(
            Promotion, 
            Listing.title_en.label("listing_title_en"), 
            Listing.title_so.label("listing_title_so"),
            PromotionPlan.name_en.label("plan_name_en"),
            PromotionPlan.name_so.label("plan_name_so")
        )
        .join(Listing, Promotion.listing_id == Listing.id)
        .join(PromotionPlan, Promotion.plan_id == PromotionPlan.id)
        .where(Promotion.status.in_([PromotionStatus.PAID, PromotionStatus.APPROVED]))
        .order_by(Promotion.updated_at.desc())
        .limit(limit)
    )
    results = db.exec(statement).all()
    
    promotions = []
    for promo, lt_en, lt_so, pn_en, pn_so in results:
        p_dict = promo.model_dump()
        p_dict["listing_title_en"] = lt_en
        p_dict["listing_title_so"] = lt_so
        p_dict["plan_name_en"] = pn_en
        p_dict["plan_name_so"] = pn_so
        promotions.append(PromotionRead(**p_dict))
    return promotions

class MatchPaymentIn(BaseModel):
    transaction_id: int

@router.post("/{promo_id}/match")
def match_payment_to_order(
    promo_id: int,
    payload: MatchPaymentIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user)
) -> Any:
    """Agent-only: Manually match a mobile transaction to a promotion order"""
    promo = db.get(Promotion, promo_id)
    tx = db.get(MobileTransaction, payload.transaction_id)
    
    if not promo or not tx:
        raise HTTPException(status_code=404, detail="Order or Transaction not found")
        
    if tx.is_linked:
        raise HTTPException(status_code=400, detail="Payment already matched to another order")
        
    # Match the payment
    tx.is_linked = True
    tx.linked_promotion_id = promo.id
    promo.status = PromotionStatus.PENDING
    promo.payment_proof = tx.reference
    promo.updated_at = datetime.utcnow()
    
    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="MATCH_PAYMENT",
        resource_type="promotion",
        resource_id=promo.id,
        details=f"Matched transaction {tx.reference} ({tx.amount}) to order {promo.id}"
    )
    db.add(log)
    db.add(tx)
    db.add(promo)
    db.commit()
    
    return {"success": True, "message": "Payment matched! Order is now PENDING activation."}

@router.post("/{promo_id}/activate")
def agent_activate_promotion(
    promo_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user)
) -> Any:
    """Agent-only: Finalize activation for a PENDING order"""
    promo = db.get(Promotion, promo_id)
    if not promo or promo.status != PromotionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not in PENDING state")
        
    activate_promotion(db, promo, matched_transaction_ref=promo.payment_proof)
    promo.status = PromotionStatus.PAID
    
    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="ACTIVATE_PROMOTION",
        resource_type="promotion",
        resource_id=promo.id,
        details="Promotion activated by agent."
    )
    db.add(log)
    db.commit()
    
    return {"success": True, "message": "Promotion activated successfully!"}

def activate_promotion(db: Session, promo: Promotion, matched_transaction_ref: str = None):
    """Refactored logic to activate a promotion (bump listing + set expiry)"""
    plan = db.get(PromotionPlan, promo.plan_id)
    if not plan:
        return
        
    # Generate unique promotion code (legacy requirement)
    code = generate_promotion_code(db)
    
    # Update promotion
    promo.promotion_code = code
    promo.status = PromotionStatus.APPROVED
    promo.approved_at = datetime.utcnow()
    promo.expires_at = datetime.utcnow() + timedelta(days=plan.duration_days)
    promo.payment_proof = matched_transaction_ref or "AUTOMATIC"
    promo.updated_at = datetime.utcnow()
    
    # Update listing boost level
    listing = db.get(Listing, promo.listing_id)
    if listing:
        boost_mapping = {
            "Standard": 1,
            "Premium": 2,
            "Diamond": 3,
            "Basic Boost": 1,
            "Premium Boost": 2,
            "Diamond Boost": 3
        }
        listing.boost_level = boost_mapping.get(plan.name_en, 1)
        listing.boost_expires_at = promo.expires_at
        db.add(listing)
    
    db.add(promo)
    db.commit()
    db.refresh(promo)

class PaymentSimulateIn(BaseModel):
    phone: str
    amount: float
    reference: Optional[str] = None

@router.post("/simulate-payment")
def simulate_mobile_payment(
    payload: PaymentSimulateIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """
    Admin-only: Simulate an incoming mobile money payment.
    Creates a record in MobileTransaction table.
    """
    tx = MobileTransaction(
        phone=payload.phone,
        amount=payload.amount,
        reference=payload.reference or f"SIM-{datetime.utcnow().strftime('%Y%H%M%S%f')}",
        timestamp=datetime.utcnow()
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return {"success": True, "transaction": tx}

@router.post("/{promo_id}/submit")
def submit_payment_proof(
    promo_id: int,
    payload: PromotionSubmitIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    statement = select(Promotion).where(Promotion.id == promo_id)
    promo = db.exec(statement).first()
    
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion request not found")
        
    promo.payment_proof = payload.payment_proof
    promo.status = PromotionStatus.SUBMITTED
    promo.updated_at = datetime.utcnow()
    
    db.add(promo)
    db.commit()
    return {"success": True}


# ===== ADMIN-ONLY ENDPOINTS =====

@router.get("/pending", response_model=List[PromotionRead])
def get_pending_promotions(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """Admin-only: Get all pending/submitted promotions awaiting approval"""
    statement = (
        select(
            Promotion, 
            Listing.title_en.label("listing_title_en"), 
            Listing.title_so.label("listing_title_so"),
            PromotionPlan.name_en.label("plan_name_en"),
            PromotionPlan.name_so.label("plan_name_so")
        )
        .join(Listing, Promotion.listing_id == Listing.id)
        .join(PromotionPlan, Promotion.plan_id == PromotionPlan.id)
        .where(Promotion.status.in_([PromotionStatus.PENDING, PromotionStatus.SUBMITTED]))
    )
    results = db.exec(statement).all()
    
    # Map raw rows to PromotionRead objects
    promotions = []
    for promo, lt_en, lt_so, pn_en, pn_so in results:
        p_dict = promo.model_dump()
        p_dict["listing_title_en"] = lt_en
        p_dict["listing_title_so"] = lt_so
        p_dict["plan_name_en"] = pn_en
        p_dict["plan_name_so"] = pn_so
        promotions.append(PromotionRead(**p_dict))
        
    return promotions

@router.post("/{promo_id}/approve")
def approve_promotion(
    promo_id: int,
    payload: PromotionApproveIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """
    Admin-only: Approve promotion and generate unique code.
    
    Workflow:
    1. Admin manually checks mobile money payment
    2. Admin clicks "Generate Promotion Code"
    3. System generates unique code (YYYYMMDD-XXX-YYY)
    4. Admin selects promotion type (plan_id)
    5. System updates listing boost level and expiry
    6. Returns code for admin to send to seller
    """
    # Get promotion
    statement = select(Promotion).where(Promotion.id == promo_id)
    promo = db.exec(statement).first()
    
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    if promo.status == PromotionStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Promotion already approved")
    
    # Get promotion plan
    plan = db.get(PromotionPlan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Promotion plan not found")
    
    # Generate unique promotion code
    code = generate_promotion_code(db)
    
    # Update promotion
    promo.promotion_code = code
    promo.plan_id = payload.plan_id
    promo.status = PromotionStatus.APPROVED
    promo.approved_by = current_user.id
    promo.approved_at = datetime.utcnow()
    promo.expires_at = datetime.utcnow() + timedelta(days=plan.duration_days)
    promo.updated_at = datetime.utcnow()
    
    # Update listing boost level
    listing = db.get(Listing, promo.listing_id)
    if listing:
        # Map plan name to boost level (1=Standard, 2=Premium, 3=Diamond)
        boost_mapping = {
            "Standard": 1,
            "Premium": 2,
            "Diamond": 3,
            "Basic Boost": 1,
            "Premium Boost": 2,
            "Diamond Boost": 3
        }
        listing.boost_level = boost_mapping.get(plan.name_en, 1)
        listing.boost_expires_at = promo.expires_at
        db.add(listing)
    
    db.add(promo)
    db.commit()
    db.refresh(promo)
    
    return {
        "success": True,
        "promotion_code": code,
        "expires_at": promo.expires_at,
        "message": f"Promotion approved! Code: {code}"
    }

@router.post("/{promo_id}/reject")
def reject_promotion(
    promo_id: int,
    payload: PromotionRejectIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """Admin-only: Reject promotion with reason"""
    statement = select(Promotion).where(Promotion.id == promo_id)
    promo = db.exec(statement).first()
    
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    promo.status = PromotionStatus.REJECTED
    promo.admin_notes = payload.reason
    promo.updated_at = datetime.utcnow()
    
    db.add(promo)
    db.commit()
    
    return {"success": True, "message": "Promotion rejected"}

@router.post("/admin/direct-promote")
def direct_promote(
    payload: PromotionCreateIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """
    Admin-only: Directly promote a listing without a pre-existing request.
    Used for phone-initiated requests where payment is confirmed manually.
    """
    # 1. Verify listing exists
    listing = db.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
        
    # 2. Get promotion plan
    plan = db.get(PromotionPlan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Promotion plan not found")
        
    # 3. Create, approve, and generate code in one action
    code = generate_promotion_code(db)
    expires_at = datetime.utcnow() + timedelta(days=plan.duration_days)
    
    promo = Promotion(
        listing_id=payload.listing_id,
        plan_id=payload.plan_id,
        status=PromotionStatus.APPROVED,
        promotion_code=code,
        approved_by=current_user.id,
        approved_at=datetime.utcnow(),
        expires_at=expires_at,
        admin_notes="Directly initiated by admin (Simple Process)"
    )
    db.add(promo)
    
    # 4. Update listing boost status
    boost_mapping = {
        "Standard": 1,
        "Premium": 2,
        "Diamond": 3
    }
    listing.boost_level = boost_mapping.get(plan.name, 1)
    listing.boost_expires_at = expires_at
    db.add(listing)
    
    db.commit()
    db.refresh(promo)
    
    return {
        "success": True,
        "promotion_code": code,
        "listing_id": listing.id,
        "listing_title_en": listing.title_en,
        "listing_title_so": listing.title_so,
        "status": "APPROVED",
        "message": f"Direct promotion active for {listing.title_en}! Code: {code}"
    }

@router.post("/codes/generate", response_model=dict)
def generate_code(
    payload: Optional[VoucherGenerateIn] = None,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """Admin-only: Generate a new unique voucher code for wallet recharge."""
    code = generate_voucher_code()
    amount = payload.amount if payload else 0.0
    
    # We create a Voucher in the wallet system
    db_voucher = Voucher(
        code=code,
        amount=amount,
        is_redeemed=False
    )
    db.add(db_voucher)
    db.commit()
    db.refresh(db_voucher)
    
    return {"code": code, "id": db_voucher.id, "amount": amount}

@router.post("/codes/apply", response_model=dict)
def apply_promo_code(
    payload: PromotionCodeApplyIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_admin_user)
) -> Any:
    """Admin-only: Apply a generated code to a listing and plan."""
    print(f"DEBUG: Applying code {payload.code} to listing {payload.listing_id} with plan {payload.plan_id}")
    # 1. Verify code exists and is valid (Check PromotionCode first, then Voucher)
    # Normalize input (Handle XXXX-XXXX and other formats)
    code_norm = payload.code.strip().upper().replace(" ", "")
    if "-" in code_norm:
        code_norm = code_norm.replace("-", "")
    
    # Try PromotionCode table (likely original format)
    # But try normalized first just in case
    statement = select(PromotionCode).where(
        PromotionCode.code == code_norm,
        PromotionCode.status == PromotionCodeStatus.GENERATED
    )
    db_code = db.exec(statement).first()
    
    # Also check explicitly for dash format if it's 8 chars
    if not db_code and len(code_norm) == 8:
        code_dashed = f"{code_norm[:4]}-{code_norm[4:]}"
        statement = select(Voucher).where(
            Voucher.code == code_dashed,
            Voucher.is_redeemed == False
        )
        db_voucher = db.exec(statement).first()
    elif not db_code:
        # Try direct match for non-standard lengths (like old format)
        statement = select(Voucher).where(
            Voucher.code == code_norm,
            Voucher.is_redeemed == False
        )
        db_voucher = db.exec(statement).first()
    else:
        db_voucher = None

    if not db_code and not db_voucher:
        raise HTTPException(status_code=400, detail="Invalid or already used code")

    # 2. Verify listing and plan
    listing = db.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing ID {payload.listing_id} not found")
        
    plan = db.get(PromotionPlan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Promotion plan ID {payload.plan_id} not found")

    # 3. Mark code as applied/redeemed
    if db_code:
        db_code.status = PromotionCodeStatus.APPLIED
        db_code.listing_id = payload.listing_id
        db_code.plan_id = payload.plan_id
        db_code.used_at = datetime.utcnow()
        db.add(db_code)
    else:
        db_voucher.is_redeemed = True
        db_voucher.redeemed_at = datetime.utcnow()
        db_voucher.redeemed_by_id = current_user.id # Admin is applying it
        db.add(db_voucher)

    # 4. Update Listing
    boost_mapping = {
        "Standard": 1,
        "Premium": 2,
        "Diamond": 3
    }
    expires_at = datetime.utcnow() + timedelta(days=plan.duration_days)
    listing.boost_level = boost_mapping.get(plan.name, 1)
    listing.boost_expires_at = expires_at
    db.add(listing)

    # 5. Create a record in Promotion table for history
    promo = Promotion(
        listing_id=payload.listing_id,
        plan_id=payload.plan_id,
        status=PromotionStatus.APPROVED,
        promotion_code=payload.code,
        approved_by=current_user.id,
        approved_at=datetime.utcnow(),
        expires_at=expires_at,
        admin_notes="Applied via manual code entry."
    )
    db.add(promo)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Promotion applied! {listing.title_en} is now promoted until {expires_at.date()}"
    }


# ─── Agent Marketing Endpoints ────────────────────────────────────────────────

from app.models.user import User
from sqlmodel import func

@router.get("/agent/conversions")
def get_agent_conversions(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
) -> Any:
    """Conversion funnel stats for the marketing view."""
    total_users = db.exec(select(func.count(User.id))).one()
    users_with_ads = db.exec(
        select(func.count(func.distinct(Listing.owner_id)))
    ).one()
    today = datetime.utcnow().date()
    week_ago = datetime.utcnow() - timedelta(days=7)
    signups_today = db.exec(
        select(func.count(User.id)).where(func.date(User.created_at) == today)
    ).one()
    signups_week = db.exec(
        select(func.count(User.id)).where(User.created_at >= week_ago)
    ).one()
    ads_today = db.exec(
        select(func.count(Listing.id)).where(func.date(Listing.created_at) == today)
    ).one()
    ads_week = db.exec(
        select(func.count(Listing.id)).where(Listing.created_at >= week_ago)
    ).one()
    active_listings = db.exec(
        select(func.count(Listing.id)).where(Listing.status == "active")
    ).one()
    conversion_rate = round((users_with_ads / total_users * 100), 1) if total_users else 0
    return {
        "total_users": total_users,
        "users_with_ads": users_with_ads,
        "conversion_rate": conversion_rate,
        "signups_today": signups_today,
        "signups_week": signups_week,
        "ads_today": ads_today,
        "ads_week": ads_week,
        "active_listings": active_listings,
    }


@router.get("/agent/signups")
def get_agent_signups(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
    skip: int = 0,
    limit: int = 50,
    search: str = "",
) -> Any:
    """List of signed-up users with their ad count."""
    stmt = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    if search:
        stmt = select(User).where(
            (User.full_name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        ).order_by(User.created_at.desc()).offset(skip).limit(limit)
    users = db.exec(stmt).all()
    result = []
    for u in users:
        ad_count = db.exec(select(func.count(Listing.id)).where(Listing.owner_id == u.id)).one()
        result.append({
            "id": u.id,
            "full_name": u.full_name or "—",
            "email": u.email,
            "phone": u.phone,
            "created_at": u.created_at.isoformat(),
            "is_active": u.is_active,
            "ad_count": ad_count,
            "has_posted": ad_count > 0,
        })
    return result


@router.get("/agent/all-listings")
def get_agent_all_listings(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
    skip: int = 0,
    limit: int = 100,
    search: str = "",
    status_filter: str = "",
) -> Any:
    """Full database listing view for agents — all statuses."""
    stmt = select(Listing, User).join(User, Listing.owner_id == User.id)
    if search:
        stmt = stmt.where(
            Listing.title_en.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    if status_filter:
        stmt = stmt.where(Listing.status == status_filter)
    stmt = stmt.order_by(Listing.created_at.desc()).offset(skip).limit(limit)
    rows = db.exec(stmt).all()
    result = []
    for row in rows:
        listing, owner = row[0], row[1]
        result.append({
            "id": listing.id,
            "title": listing.title_en,
            "title_so": listing.title_so,
            "is_active": listing.status == "active",
            "status": listing.status,
            "created_at": listing.created_at.isoformat(),
            "updated_at": listing.updated_at.isoformat(),
            "owner_id": owner.id,
            "owner_name": owner.full_name or "—",
            "owner_email": owner.email,
            "owner_phone": owner.phone,
            "price": listing.price,
            "location": listing.location,
            "boost_level": listing.boost_level,
            "views": listing.views,
        })
    return result


@router.post("/agent/listings/{listing_id}/end")
def agent_end_listing(
    listing_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
) -> Any:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.status = "closed"
    db.add(listing)
    db.add(AuditLog(
        action="END_LISTING",
        user_id=current_user.id,
        user_name=current_user.full_name,
        resource_type="listing",
        resource_id=listing_id,
        details=f"Agent ended listing #{listing_id}: {listing.title_en}",
    ))
    db.commit()
    return {"success": True}


@router.post("/agent/listings/{listing_id}/reactivate")
def agent_reactivate_listing(
    listing_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
) -> Any:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.status = "active"
    db.add(listing)
    db.add(AuditLog(
        action="REACTIVATE_LISTING",
        user_id=current_user.id,
        user_name=current_user.full_name,
        resource_type="listing",
        resource_id=listing_id,
        details=f"Agent reactivated listing #{listing_id}: {listing.title_en}",
    ))
    db.commit()
    return {"success": True}


@router.post("/agent/listings/{listing_id}/approve")
def agent_approve_listing(
    listing_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
) -> Any:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.status = "active"
    db.add(listing)
    db.add(AuditLog(
        action="APPROVE_LISTING",
        user_id=current_user.id,
        user_name=current_user.full_name,
        resource_type="listing",
        resource_id=listing_id,
        details=f"Agent approved listing #{listing_id}: {listing.title_en}",
    ))
    db.commit()
    return {"success": True}


@router.post("/agent/listings/{listing_id}/reject")
def agent_reject_listing(
    listing_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_agent_user),
) -> Any:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.status = "rejected"
    db.add(listing)
    db.add(AuditLog(
        action="REJECT_LISTING",
        user_id=current_user.id,
        user_name=current_user.full_name,
        resource_type="listing",
        resource_id=listing_id,
        details=f"Agent rejected listing #{listing_id}: {listing.title_en}",
    ))
    db.commit()
    return {"success": True}
