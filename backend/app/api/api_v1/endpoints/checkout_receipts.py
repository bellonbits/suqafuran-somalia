from typing import Any, List, Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session
from pydantic import BaseModel
from app.api import deps
from app.models.checkout_receipt import CheckoutReceipt

router = APIRouter()


class ReceiptItemIn(BaseModel):
    listing_id: Optional[int] = None
    title: str
    price: float
    quantity: int = 1


class ReceiptCreateIn(BaseModel):
    seller_id: int
    items: List[ReceiptItemIn]
    total_amount: float


@router.post("/", response_model=CheckoutReceipt)
def create_receipt(
    payload: ReceiptCreateIn,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
) -> Any:
    receipt = CheckoutReceipt(
        buyer_id=current_user.id,
        seller_id=payload.seller_id,
        items=[item.dict() for item in payload.items],
        total_amount=payload.total_amount,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt
