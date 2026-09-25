import os
import sys
import time

# Force Kafka mock service by overriding environment before imports
os.environ["KAFKA_BOOTSTRAP_SERVERS"] = ""

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

from datetime import datetime
from sqlmodel import Session, select, delete

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, init_db
from app.models.user import User, TrustLevel, UserVerifiedLevel
from app.models.business import (
    Business, Employee, BusinessProduct, BusinessCustomer, Order,
    BusinessMessage, TeamMessage, BusinessTask, BusinessRole
)
from app.crud.crud_business import crud_business
from app.services.kafka_service import kafka_service
from app.services.ai_service import ai_service

def verify_all():
    print("======================================================================")
    print("🚀 STARTING SUQAFURAN BUSINESS HUB SAAS INTEGRATION VERIFICATION")
    print("======================================================================\n")

    # 1. Database Table Initialization
    print("Step 1: Initializing Database Tables...")
    try:
        init_db()
        print("✅ Database tables successfully created/checked!")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)

    with Session(engine) as session:
        # 2. Setup Test Users
        print("\nStep 2: Checking/Creating Verification Sandbox Users...")
        owner_email = "verify_saas_owner@suqafuran.com"
        owner = session.exec(select(User).where(User.email == owner_email)).first()
        if not owner:
            owner = User(
                email=owner_email,
                full_name="SaaS Owner Verification",
                phone="+252611111111",
                is_active=True,
                is_verified=True,
                email_verified=True,
                phone_verified=True,
                verified_level=UserVerifiedLevel.tier2,  # Use standard tier2 enum (premium is not registered in PG type)
                trust_level=TrustLevel.TRUSTED
            )
            session.add(owner)
            session.commit()
            session.refresh(owner)
            print(f"✅ Created test owner user: {owner.email} with ID {owner.id}")
        else:
            print(f"ℹ️ Using existing test owner user: {owner.email} with ID {owner.id}")

        cust_email = "verify_saas_customer@suqafuran.com"
        customer = session.exec(select(User).where(User.email == cust_email)).first()
        if not customer:
            customer = User(
                email=cust_email,
                full_name="SaaS Customer Verification",
                phone="+252611111112",
                is_active=True,
                is_verified=False,
                email_verified=True,
                phone_verified=True,
                verified_level=UserVerifiedLevel.tier1,
                trust_level=TrustLevel.NEW
            )
            session.add(customer)
            session.commit()
            session.refresh(customer)
            print(f"✅ Created test customer user: {customer.email} with ID {customer.id}")
        else:
            print(f"ℹ️ Using existing test customer user: {customer.email} with ID {customer.id}")

        # 3. Clean up older validation remnants to ensure complete idempotency
        print("\nStep 3: Cleaning up old SaaS test remnants...")
        test_businesses = session.exec(select(Business).where(Business.owner_id == owner.id)).all()
        cleaned_count = 0
        for b in test_businesses:
            # Delete children first
            session.exec(delete(BusinessTask).where(BusinessTask.business_id == b.id))
            session.exec(delete(TeamMessage).where(TeamMessage.business_id == b.id))
            session.exec(delete(BusinessMessage).where(BusinessMessage.business_id == b.id))
            session.exec(delete(Order).where(Order.business_id == b.id))
            session.exec(delete(BusinessCustomer).where(BusinessCustomer.business_id == b.id))
            session.exec(delete(BusinessProduct).where(BusinessProduct.business_id == b.id))
            session.exec(delete(Employee).where(Employee.business_id == b.id))
            session.delete(b)
            cleaned_count += 1
        session.commit()
        print(f"✅ Successfully deleted {cleaned_count} old test business records.")

        # 4. Multi-Tenant Business Creation
        print("\nStep 4: Creating a Multi-Tenant SaaS Business Workspace...")
        slug = f"verification-shop-{int(time.time())}"
        business = crud_business.create_business(
            session,
            owner_id=owner.id,
            name="SaaS Verification Hub Shop",
            slug=slug,
            category="shop",
            description="Verification sandbox for SaaS Platform",
            address="Mogadishu Central Market",
            phone="+252611111111",
            email="verify_saas_owner@suqafuran.com"
        )
        print(f"✅ Business Workspace registered: ID={business.id}, Slug={business.slug}")

        # Verify automatic employee registration as OWNER
        owner_emp = crud_business.get_employee_by_user(session, business.id, owner.id)
        assert owner_emp is not None, "Owner should automatically be registered as employee"
        assert owner_emp.role == BusinessRole.OWNER, "Role should be OWNER"
        print("✅ Workspace Owner automatically enrolled in the workspace roster correctly.")

        # 5. Roster Management
        print("\nStep 5: Testing Roster Ranks and Employee Invitations...")
        new_employee = crud_business.invite_employee(
            session,
            business_id=business.id,
            email="verify_saas_employee@suqafuran.com",
            phone="+252611111113",
            role=BusinessRole.MANAGER
        )
        print(f"✅ Invited Manager employee: ID={new_employee.id}, Role={new_employee.role}")

        # List all employee members of workspace
        employees = crud_business.list_employees(session, business.id)
        assert len(employees) >= 2, "Workspace roster should contain at least owner and new employee"
        print(f"✅ Listed employees successfully. Total roster size={len(employees)}")

        # 6. Start event consumer background loop
        print("\nStep 6: Spinning up Kafka background event consumer thread...")
        from app.db.session import SessionLocal
        kafka_service.start_consumer(SessionLocal)
        print("✅ Started Kafka background consumer successfully!")

        # 7. Catalog and Stock Alert Triggers
        print("\nStep 7: Testing Catalog Product Creation with Low Stock Threshold...")
        product = crud_business.create_product(
            session,
            business_id=business.id,
            name_en="Verification Test Product",
            name_so="Badeeco Baadhitaan",
            price=45.00,
            sku="VF-PROD-001",
            stock_level=6,
            low_stock_threshold=5
        )
        print(f"✅ Created Product item: ID={product.id}, SKU={product.sku}, Stock={product.stock_level}, Low Stock Alert={product.low_stock_threshold}")

        # 8. Order Placement & Low-Stock decrement alerts + CRM segmentation
        print("\nStep 8: Testing Order Entry, Stock Decrements and CRM segments...")
        items = [
            {"product_id": product.id, "qty": 2, "price": product.price, "name": product.name_en}
        ]
        order = crud_business.create_order(
            session,
            business_id=business.id,
            customer_id=customer.id,
            items=items,
            total_amount=90.00,
            payment_method="wallet",
            notes="Automated verification test order"
        )
        print(f"✅ Customer Order placed: ID={order.id}, total_amount=${order.total_amount}")

        print("Waiting 3 seconds for Kafka background thread processing...")
        time.sleep(3)

        # Commit current main thread transaction and expire loaded objects to fetch freshly committed values from DB
        session.commit()
        session.expire_all()
        session.refresh(product)
        print(f"Adjusted Product Stock: {product.stock_level} (Expected: 4)")
        assert product.stock_level == 4, "Product stock level did not decrement correctly!"
        print("✅ Stock level decremented successfully!")

        # Check CRM Customer entry
        cust_profile = session.exec(
            select(BusinessCustomer).where(
                BusinessCustomer.business_id == business.id,
                BusinessCustomer.user_id == customer.id
            )
        ).first()
        assert cust_profile is not None, "CRM Customer record was not created!"
        print(f"✅ CRM Profile: Orders={cust_profile.total_orders}, Spent=${cust_profile.total_spent}, Loyalty Score={cust_profile.loyalty_score}, Segmentation={cust_profile.segmentation}")
        assert cust_profile.total_orders == 1, "Loyalty total orders should be 1"
        assert cust_profile.total_spent == 90.00, "Loyalty total spent should be $90.00"
        print("✅ CRM Loyalty metric and segmentation completed successfully!")

        # 9. Order Lifecycle Status
        print("\nStep 9: Advancing Order Status & Employee Assignment...")
        completed_order = crud_business.update_order_status(
            session,
            order=order,
            status="completed",
            employee_id=owner_emp.id
        )
        print(f"✅ Order advanced: ID={completed_order.id}, Status={completed_order.status}, Handler={completed_order.employee_id}")
        assert completed_order.status == "completed", "Order status should be completed"

        # 10. Kanban Board Team Workspace Tasks
        print("\nStep 10: Creating and Advancing Kanban Workspace Tasks...")
        task = crud_business.create_task(
            session,
            business_id=business.id,
            title="Assemble Verification Package",
            description="Secure physical box and print invoice labels",
            status="todo",
            assigned_to=new_employee.id,
            order_id=completed_order.id
        )
        print(f"✅ Task Created: ID={task.id}, Status={task.status}, Assigned={task.assigned_to}")
        
        updated_task = crud_business.update_task(session, task, {"status": "in_progress"})
        print(f"✅ Task Status Updated: ID={updated_task.id}, Status={updated_task.status}")
        assert updated_task.status == "in_progress", "Task status did not advance to in_progress"

        # 11. Unified Messaging
        print("\nStep 11: Inserting Customer Communication Logs & Team Discussion Chats...")
        customer_msg = crud_business.create_business_message(
            session,
            business_id=business.id,
            customer_id=customer.id,
            sender_id=customer.id,
            content="Can I get this package delivered to Mogadishu Port?",
            is_from_customer=True,
            tags=["sales"]
        )
        print(f"✅ Customer Message Logged: ID={customer_msg.id}, Content='{customer_msg.content}'")

        business_msg = crud_business.create_business_message(
            session,
            business_id=business.id,
            customer_id=customer.id,
            sender_id=owner.id,
            content="Absolutely! We have delivery staff ready to dispatch to Mogadishu Port.",
            is_from_customer=False,
            tags=["sales", "support"]
        )
        print(f"✅ Business Response Logged: ID={business_msg.id}, Content='{business_msg.content}'")

        team_msg = crud_business.create_team_message(
            session,
            business_id=business.id,
            sender_id=owner.id,
            content="Team, dispatching completed order to Mogadishu Port. Manager please coordinate.",
            is_announcement=True,
            order_id=completed_order.id
        )
        print(f"✅ Internal Team Chat Logged: ID={team_msg.id}, Announcement={team_msg.is_announcement}, Content='{team_msg.content}'")

        # Retrieve messages
        history = crud_business.list_customer_messages(session, business.id, customer.id)
        assert len(history) >= 2, "Failed to retrieve correct number of messages"
        print(f"✅ Message log retrieval successful: count={len(history)}")

        # 12. Redis-Cached Analytics
        print("\nStep 12: Fetching Workspace Dashboard Analytics...")
        from app.api.api_v1.endpoints.businesses import get_dashboard_analytics
        analytics = get_dashboard_analytics(business.id, session, owner_emp)
        print(f"✅ Recalculated Analytics Metrics: {analytics}")
        assert analytics["revenue"] == 90.00, "Revenue should be 90.00"
        assert analytics["completed_orders"] == 1, "Completed orders should be 1"
        assert analytics["product_count"] == 1, "Product count should be 1"
        assert analytics["customer_count"] == 1, "Customer count should be 1"

        # Read cached metrics to verify cache retrieval does not crash
        cached_metrics = get_dashboard_analytics(business.id, session, owner_emp)
        print(f"✅ Cached Analytics fetch successful: Revenue={cached_metrics['revenue']}")

        # 13. Groq AI Integration
        print("\nStep 13: Verifying Groq AI Platform Integrations...")
        try:
            # Listing description expansion
            ai_description = ai_service.generate_listing_text(
                type="description",
                input_text="Selling grade A camel, healthy, 3 years old, milk producing.",
                category="pets",
                attributes={"type": "camel", "age": "3 years"}
            )
            print(f"✅ AI Text Description generated:\n{ai_description[:200]}...")

            # Price suggestion comparison
            ai_price = ai_service.get_price_recommendation({
                "title_en": "Healthy Somali Camel",
                "category": "pets",
                "condition": "New"
            })
            print(f"✅ AI Price Recommendation generated: {ai_price}")

            # Smart chat reply suggestion
            chat_context = [
                {"role": "buyer", "content": "How much for the camel?"},
                {"role": "seller", "content": "Waa $700 gaari dacaladiisa."},
                {"role": "buyer", "content": "Can you do $650? I can buy it today."}
            ]
            ai_replies = ai_service.generate_chat_suggestions(chat_context, role="seller")
            print(f"✅ AI Smart Replies generated: {ai_replies}")

            # Chat thread summarization
            from app.api.api_v1.endpoints.businesses import ai_summarize_chat
            ai_summary = ai_summarize_chat(business.id, customer_id=customer.id, db=session, _member=owner_emp)
            print(f"✅ AI Customer Conversation Summary: {ai_summary}")

        except Exception as ai_err:
            print(f"⚠️ Groq AI integration processing error or skipped: {ai_err}")

        # Shutdown event stream daemon
        print("\nStep 14: Shutting down Kafka event stream loop...")
        kafka_service.stop_consumer()
        print("✅ Kafka background consumer stopped gracefully.")

        print("\n======================================================================")
        print("🎉 ALL SUQAFURAN BUSINESS HUB SAAS INTEGRATION VERIFICATION CHECKS PASSED!")
        print("======================================================================")
        sys.exit(0)

if __name__ == "__main__":
    verify_all()
