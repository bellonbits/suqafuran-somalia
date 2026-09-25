from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import Session, select
from app.models.promotion import Promotion, PromotionStatus, PromotionPlan
from app.models.mobile_money import MobileTransaction
from app.models.listing import Listing

class PaymentService:
    def match_transaction(self, db: Session, transaction: MobileTransaction) -> Optional[Promotion]:
        """
        Attempt to match an incoming mobile money transaction to a pending promotion order.
        Matching Criteria:
        0. Priority: Lipana Transaction ID (exact match)
        1. Status is WAITING_FOR_PAYMENT
        2. Amount matches exactly
        3. Created within the last 60 minutes
        4. Phone number matches (fuzzy match on last 9 digits)
        """
        
        # 0. Priority Match: Try matching by Lipana Transaction ID first (most accurate)
        if transaction.reference:
            statement = select(Promotion).where(
                Promotion.status == PromotionStatus.WAITING_FOR_PAYMENT,
                Promotion.lipana_tx_id == transaction.reference
            )
            matched_order = db.exec(statement).first()
            if matched_order:
                self._activate_promotion(db, matched_order, transaction)
                return matched_order

        # 1. Clean the transaction phone (take last 9 digits)
        # e.g. 252615555555 -> 615555555
        trans_phone_clean = transaction.phone[-9:] if len(transaction.phone) >= 9 else transaction.phone
        
        # 2. Find potential orders
        # We look for orders created recently (e.g. last 1 hour) to avoid false positives from old abandoned orders
        time_threshold = datetime.utcnow() - timedelta(hours=1)
        
        statement = select(Promotion).where(
            Promotion.status == PromotionStatus.WAITING_FOR_PAYMENT,
            Promotion.amount == transaction.amount,
            Promotion.created_at >= time_threshold
        )
        
        potential_matches = db.exec(statement).all()
        
        matched_order = None
        
        for order in potential_matches:
            if not order.payment_phone:
                continue
                
            order_phone_clean = order.payment_phone[-9:] if len(order.payment_phone) >= 9 else order.payment_phone
            
            if order_phone_clean == trans_phone_clean:
                matched_order = order
                break
        
        if matched_order:
            self._activate_promotion(db, matched_order, transaction)
            return matched_order
        
        return None

    def _activate_promotion(self, db: Session, order: Promotion, transaction: MobileTransaction):
        # 1. Update Order
        order.status = PromotionStatus.PAID
        order.payment_proof = transaction.reference # Link reference
        order.updated_at = datetime.utcnow()
        
        # Calculate expiration
        plan = db.get(PromotionPlan, order.plan_id)
        if plan:
            order.expires_at = datetime.utcnow() + timedelta(days=plan.duration_days)
        
        db.add(order)
        
        # 2. Update Transaction
        transaction.is_linked = True
        transaction.linked_promotion_id = order.id
        db.add(transaction)
        
        # 3. Update Listing
        listing = db.get(Listing, order.listing_id)
        if listing:
            # Determine boost level from Plan Name (Convention)
            # This is a simple heuristic, ideally Plan model has boost_level
            boost_level = 1 # Default Basic
            if plan:
                name_lower = plan.name.lower()
                if "diamond" in name_lower or "enterprise" in name_lower:
                    boost_level = 3
                elif "gold" in name_lower or "vip" in name_lower:
                    boost_level = 2
            
            listing.boost_level = boost_level
            listing.boost_expires_at = order.expires_at
            listing.status = "active" # Activate listing if it was pending
            listing.updated_at = datetime.utcnow()
            db.add(listing)
        
        db.commit()
        db.refresh(order)
        print(f"PAYMENT MATCHED: Order {order.id} linked to Trans {transaction.reference}")

        # 4. Create Notification
        try:
            from app.crud.crud_notification import crud_notification
            crud_notification.create(
                db,
                obj_in={
                    "type": "ad_approved",
                    "data": {
                        "message": f"Your promotion (Order #{order.id}) was successfully activated! Your ad is now boosted."
                    }
                },
                user_id=order.owner_id
            )
        except Exception as e:
            print(f"Failed to create notification for Order {order.id}: {e}")

payment_service = PaymentService()
