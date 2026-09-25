#!/usr/bin/env python3
"""
Seed script to populate database with sample orders and customers
Run with: python seed_data.py
"""
import sys
from datetime import datetime, timedelta
from sqlmodel import Session, create_engine, SQLModel
from app.models.user import User
from app.models.listing import Listing
from app.models.order import Order, OrderItem
from app.models.conversation import Conversation, ConversationMessage
from app.core.config import settings
from app.core.security import get_password_hash

# Database connection
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)

def seed_database():
    """Create sample data"""
    with Session(engine) as session:
        print("🌱 Starting database seeding...")

        # Create sample customers
        customers = []
        customer_names = [
            ("Alice Johnson", "alice@example.com"),
            ("Bob Smith", "bob@example.com"),
            ("Carol White", "carol@example.com"),
            ("David Brown", "david@example.com"),
            ("Eva Garcia", "eva@example.com"),
        ]

        for name, email in customer_names:
            user = User(
                full_name=name,
                email=email,
                hashed_password=get_password_hash("password123"),
                is_active=True,
                is_verified=True,
                phone="+254712345678",
            )
            session.add(user)
            session.flush()
            customers.append(user)
            print(f"✅ Created customer: {name}")

        # Get seller (user ID 1)
        seller = session.query(User).filter(User.id == 1).first()
        if not seller:
            seller = User(
                full_name="Mwalimu Shop",
                email="seller@example.com",
                hashed_password=get_password_hash("password123"),
                is_active=True,
                is_verified=True,
                phone="+254720000000",
            )
            session.add(seller)
            session.flush()
            print(f"✅ Created seller: Mwalimu Shop")

        # Create sample products/listings
        products = []
        product_data = [
            ("Toyota Camry 2020", "Car in excellent condition", 2500000, 1),
            ("Honda Civic 2019", "Reliable family car", 1800000, 2),
            ("Nissan Altima 2021", "Fuel efficient sedan", 2200000, 3),
            ("Mazda CX-5 2020", "Spacious SUV", 2800000, 1),
            ("Subaru Outback 2019", "All-wheel drive capable", 2400000, 2),
        ]

        for title, description, price, stock in product_data:
            listing = Listing(
                seller_id=seller.id,
                title_en=title,
                title_so=title,
                description_en=description,
                description_so=description,
                category="Cars",
                price=price,
                currency="KES",
                quantity=stock,
                is_active=True,
            )
            session.add(listing)
            session.flush()
            products.append(listing)
            print(f"✅ Created product: {title} - KSh {price:,}")

        # Create sample orders
        base_date = datetime.utcnow()
        for i, customer in enumerate(customers[:3]):
            for j in range(2):
                order_date = base_date - timedelta(days=(i * 5 + j * 2))
                order = Order(
                    seller_id=seller.id,
                    customer_id=customer.id,
                    customer_name=customer.full_name,
                    total_amount=products[i].price,
                    status="confirmed" if j == 0 else "pending",
                    created_at=order_date,
                    updated_at=order_date,
                )
                session.add(order)
                session.flush()

                # Add order items
                order_item = OrderItem(
                    order_id=order.id,
                    listing_id=products[i].id,
                    quantity=1,
                    price=products[i].price,
                )
                session.add(order_item)

                status_text = "Confirmed" if j == 0 else "Pending"
                print(f"✅ Created order #{order.id}: {customer.full_name} - KSh {order.total_amount:,} ({status_text})")

        # Create sample conversations
        for customer in customers[:2]:
            conversation = Conversation(
                seller_id=seller.id,
                customer_id=customer.id,
                last_message=f"Hello, interested in your {products[0].title_en}",
                unread_count=0,
            )
            session.add(conversation)
            session.flush()

            # Add messages
            message = ConversationMessage(
                conversation_id=conversation.id,
                sender_type="customer",
                sender_id=customer.id,
                message=f"Hi! Is the {products[0].title_en} still available?",
            )
            session.add(message)

            reply = ConversationMessage(
                conversation_id=conversation.id,
                sender_type="seller",
                sender_id=seller.id,
                message="Yes! It's available. Would you like to schedule a viewing?",
            )
            session.add(reply)

            print(f"✅ Created conversation with {customer.full_name}")

        session.commit()
        print("\n✨ Database seeding complete!")
        print(f"📊 Created {len(customers)} customers")
        print(f"📦 Created {len(products)} products")
        print(f"📋 Created 6 orders")
        print(f"💬 Created 2 conversations with messages")

if __name__ == "__main__":
    try:
        seed_database()
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        sys.exit(1)
