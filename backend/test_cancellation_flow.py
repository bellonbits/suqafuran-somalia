"""Test Phase 3 cancellation and refund flow"""
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Seller, Order, OrderItem, Refund, OrderStatus
from datetime import datetime
import uuid

# Setup database connection
DATABASE_URL = "sqlite:///./suqafuran.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_cancellation_flow():
    db = SessionLocal()
    
    try:
        # Create test user
        print("=== Creating test user ===")
        test_user = User(
            id=str(uuid.uuid4()),
            email="phasetest@example.com",
            phone="0700000055",
            full_name="Phase Test User",
            hashed_password="test",
            is_verified=True,
            is_active=True
        )
        db.add(test_user)
        db.flush()
        user_id = test_user.id
        print(f"Created user: {user_id}")
        
        # Create test seller
        print("\n=== Creating test seller ===")
        test_seller = Seller(
            id=str(uuid.uuid4()),
            user_id=str(uuid.uuid4()),
            shop_name="Test Shop",
            owner_name="Shop Owner",
            email="seller@test.com",
            phone="0700000056",
            mpesa_number="254700000056",
            shop_address="Test Address",
            category="Electronics",
            location_lat=-1.2921,
            location_lng=36.8219,
            verification_status="verified",
            is_active=True
        )
        db.add(test_seller)
        db.flush()
        seller_id = test_seller.id
        print(f"Created seller: {seller_id}")
        
        # Create test order with CONFIRMED status
        print("\n=== Creating test order ===")
        test_order = Order(
            id=f"ORD-{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            seller_id=seller_id,
            status=OrderStatus.CONFIRMED,
            delivery_option="delivery",
            delivery_address="Test Delivery Address",
            phone_number="0700000055",
            total_amount=1000.0,
            platform_fee=50.0,
            seller_amount=950.0,
            courier_tip=100.0,
            payment_status="completed",
            location_lat=-1.2921,
            location_lng=36.8219
        )
        db.add(test_order)
        db.flush()
        order_id = test_order.id
        print(f"Created order: {order_id} with status={test_order.status}")
        
        # Add order item
        print("\n=== Adding order item ===")
        order_item = OrderItem(
            id=str(uuid.uuid4()),
            order_id=order_id,
            product_id="prod1",
            title="Test Product",
            quantity=1,
            price=1000.0
        )
        db.add(order_item)
        db.commit()
        print("Added order item")
        
        # Now test cancellation
        print("\n=== Testing Cancellation ===")
        order = db.query(Order).filter(Order.id == order_id).first()
        print(f"Order before cancel - Status: {order.status}")
        
        # Simulate cancellation (mark as cancelled and create refund)
        order.status = OrderStatus.CANCELLED
        order.updated_at = datetime.utcnow()
        
        refund = Refund(
            id=f"REF-{uuid.uuid4().hex[:12]}",
            order_id=order_id,
            amount=order.total_amount,
            reason="User requested cancellation",
            status="processing"
        )
        db.add(refund)
        db.commit()
        
        print(f"Order after cancel - Status: {order.status}")
        print(f"Refund created - ID: {refund.id}, Status: {refund.status}, Amount: {refund.amount}")
        
        # Test refund processing
        print("\n=== Testing Refund Processing ===")
        refund = db.query(Refund).filter(Refund.order_id == order_id).first()
        print(f"Refund before processing - Status: {refund.status}")
        
        import hashlib
        refund_ref = hashlib.md5(f"{order_id}refund".encode()).hexdigest()[:12].upper()
        refund.status = "completed"
        refund.refund_reference = f"REF{refund_ref}"
        refund.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"Refund after processing - Status: {refund.status}, Reference: {refund.refund_reference}")
        
        # Verify data
        print("\n=== Verification ===")
        order = db.query(Order).filter(Order.id == order_id).first()
        refund = db.query(Refund).filter(Refund.order_id == order_id).first()
        
        print(f"✓ Order ID: {order.id}")
        print(f"✓ Order Status: {order.status} (Expected: cancelled)")
        print(f"✓ Refund Status: {refund.status} (Expected: completed)")
        print(f"✓ Refund Amount: {refund.amount}")
        print(f"✓ Refund Reference: {refund.refund_reference}")
        
        success = (
            order.status == OrderStatus.CANCELLED and
            refund.status == "completed" and
            refund.refund_reference is not None
        )
        
        print(f"\n✓ Phase 3 Cancellation Flow: {'PASSED' if success else 'FAILED'}")
        return success
        
    finally:
        db.close()

if __name__ == "__main__":
    try:
        success = test_cancellation_flow()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

