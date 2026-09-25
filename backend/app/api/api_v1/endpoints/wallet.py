from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.api import deps
from app.crud import crud_wallet
from app.models.wallet import Wallet, Transaction, Voucher
from app.models.user import User
from app.models.audit import AuditLog
from pydantic import BaseModel

router = APIRouter()

class DepositRequest(BaseModel):
    amount: float
    description: str = "Deposit"

class RechargeRequest(BaseModel):
    code: str

class VoucherCreate(BaseModel):
    code: str
    amount: float

@router.get("/balance", response_model=dict)
def get_balance(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user's wallet balance.
    """
    wallet = crud_wallet.get_wallet_by_user_id(db, user_id=current_user.id)
    if not wallet:
        # Lazy create wallet if it doesn't exist
        wallet = crud_wallet.create_wallet(db, user_id=current_user.id)
    
    return {
        "balance": wallet.balance,
        "currency": wallet.currency,
        "updated_at": wallet.updated_at,
        "total_spent": crud_wallet.get_total_spent(db, wallet_id=wallet.id),
        "active_boosts": crud_wallet.get_active_boosts_count(db, user_id=current_user.id)
    }

@router.get("/transactions", response_model=List[Transaction])
def get_transactions(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get current user's wallet transactions.
    """
    wallet = crud_wallet.get_wallet_by_user_id(db, user_id=current_user.id)
    if not wallet:
        wallet = crud_wallet.create_wallet(db, user_id=current_user.id)
    
    return crud_wallet.get_transactions(db, wallet_id=wallet.id, skip=skip, limit=limit)

@router.post("/deposit", response_model=dict)
def deposit(
    *,
    db: Session = Depends(deps.get_db),
    deposit_in: DepositRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Deposit funds into user wallet (Mock).
    """
    if deposit_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    wallet = crud_wallet.get_wallet_by_user_id(db, user_id=current_user.id)
    if not wallet:
        wallet = crud_wallet.create_wallet(db, user_id=current_user.id)
    
    crud_wallet.deposit_funds(db, wallet=wallet, amount=deposit_in.amount, description=deposit_in.description)
    log = AuditLog(
        user_id=current_user.id,
        action="WALLET_DEPOSIT",
        resource_type="wallet",
        resource_id=wallet.id,
        details=f"User deposited ${deposit_in.amount} into wallet. New balance: ${wallet.balance}"
    )
    db.add(log)
    db.commit()
    return {"message": "Deposit successful", "new_balance": wallet.balance}

@router.post("/recharge", response_model=dict)
def recharge(
    *,
    db: Session = Depends(deps.get_db),
    recharge_in: RechargeRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Redeem a recharge voucher code.
    """
    code = recharge_in.code.strip().upper().replace(" ", "")
    # Support XXXX-XXXX format even if entered without dash
    if "-" in code:
        code = code.replace("-", "")
    
    # Standardize to XXXX-XXXX if it was 8 chars
    if len(code) == 8:
        code = f"{code[:4]}-{code[4:]}"
        
    voucher = crud_wallet.get_voucher_by_code(db, code=code)
    if not voucher:
        raise HTTPException(status_code=404, detail="Invalid recharge code")
    
    if voucher.is_redeemed:
        raise HTTPException(status_code=400, detail="Code already redeemed")
    
    wallet = crud_wallet.redeem_voucher(db, voucher=voucher, user_id=current_user.id)
    log = AuditLog(
        user_id=current_user.id,
        action="VOUCHER_REDEEMED",
        resource_type="wallet",
        resource_id=wallet.id,
        details=f"User redeemed voucher for ${voucher.amount}. New balance: ${wallet.balance}"
    )
    db.add(log)
    db.commit()
    return {
        "message": "Recharge successful",
        "amount": voucher.amount,
        "new_balance": wallet.balance
    }

@router.get("/vouchers", response_model=List[Voucher])
def get_vouchers(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get all vouchers (Admin only).
    """
    return crud_wallet.get_all_vouchers(db)

@router.post("/vouchers", response_model=Voucher)
def create_voucher(
    *,
    db: Session = Depends(deps.get_db),
    voucher_in: VoucherCreate,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Generate a new recharge voucher (Admin only).
    """
    existing = crud_wallet.get_voucher_by_code(db, code=voucher_in.code)
    if existing:
        raise HTTPException(status_code=400, detail="Voucher code already exists")
    
    db_obj = Voucher(
        code=voucher_in.code,
        amount=voucher_in.amount
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
