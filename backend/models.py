from sqlalchemy import Column, String, Integer, Float, DateTime, Enum, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid
from database import Base

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAYMENT_PENDING = "payment_pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY_FOR_PICKUP = "ready_for_pickup"
    IN_DELIVERY = "in_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

class PaymentMethod(str, enum.Enum):
    MPESA = "mpesa"
    CASH_ON_DELIVERY = "cash_on_delivery"

class DeliveryOption(str, enum.Enum):
    DELIVERY = "delivery"
    PICKUP = "pickup"

class IssueType(str, enum.Enum):
    ITEM_MISMATCH = "item_mismatch"
    DAMAGED = "damaged"
    MISSING_ITEMS = "missing_items"
    OTHER = "other"

class IssueStatus(str, enum.Enum):
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class SellerVerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

# User Model
class User(Base):
    __tablename__ = "user"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    orders = relationship("Order", back_populates="user")

# Seller Model
class Seller(Base):
    __tablename__ = "sellers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    shop_name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=False)
    mpesa_number = Column(String, unique=True, nullable=False)
    mpesa_verified = Column(Boolean, default=False)
    shop_address = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    verification_status = Column(String, default=SellerVerificationStatus.PENDING)
    is_active = Column(Boolean, default=True)
    location_lat = Column(Float, nullable=False)
    location_lng = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    orders = relationship("Order", back_populates="seller")
    withdrawals = relationship("Withdrawal", back_populates="seller")
    ratings = relationship("Rating", back_populates="seller")

# Category Model
class Category(Base):
    __tablename__ = "category"

    id = Column(Integer, primary_key=True)
    name_en = Column(String, nullable=False)
    name_so = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    icon_name = Column(String)
    image_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Listing Model
class Listing(Base):
    __tablename__ = "listing"

    id = Column(Integer, primary_key=True)
    title_en = Column(String, nullable=False)
    title_so = Column(String, nullable=False)
    description_en = Column(Text)
    description_so = Column(Text)
    price = Column(Float, nullable=False)
    images = Column(String)  # JSON array as string
    status = Column(String, default="active")
    category_id = Column(Integer, ForeignKey("category.id"))
    owner_id = Column(Integer)  # Reference to User id
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Order Model
class Order(Base):
    __tablename__ = "orders"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False)
    status = Column(String, default=OrderStatus.PENDING)
    delivery_option = Column(String, default=DeliveryOption.DELIVERY)
    delivery_address = Column(Text)
    phone_number = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    platform_fee = Column(Float, nullable=False)
    seller_amount = Column(Float, nullable=False)
    courier_tip = Column(Float, default=0)
    payment_status = Column(String, default=PaymentStatus.PENDING)
    payment_method = Column(String, default=PaymentMethod.MPESA)
    payment_reference = Column(String)
    location_lat = Column(Float, nullable=False)
    location_lng = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="orders")
    seller = relationship("Seller", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False)
    issue = relationship("Issue", back_populates="order", uselist=False)
    refund = relationship("Refund", back_populates="order", uselist=False)
    rating = relationship("Rating", back_populates="order", uselist=False)

# Order Item Model
class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    
    order = relationship("Order", back_populates="items")

# Payment Model
class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    status = Column(String, default=PaymentStatus.PENDING)
    mpesa_reference = Column(String)
    merchant_request_id = Column(String)
    checkout_request_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    order = relationship("Order", back_populates="payment")

# Refund Model
class Refund(Base):
    __tablename__ = "refunds"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    reason = Column(String)  # cancellation reason
    status = Column(String, default="pending")  # pending, processing, completed, failed
    refund_reference = Column(String)  # M-Pesa refund reference
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="refund")

# Issue Model
class Issue(Base):
    __tablename__ = "issues"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, unique=True)
    issue_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default=IssueStatus.UNDER_REVIEW)
    resolution_type = Column(String)  # refund or replacement
    admin_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    order = relationship("Order", back_populates="issue")

# Rating Model
class Rating(Base):
    __tablename__ = "ratings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, unique=True)
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    review_text = Column(Text)  # Optional detailed review
    is_verified_purchase = Column(Boolean, default=True)
    helpful_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="rating")
    user = relationship("User")
    seller = relationship("Seller", back_populates="ratings")

# Withdrawal Model
class Withdrawal(Base):
    __tablename__ = "withdrawals"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default=PaymentStatus.PENDING)
    mpesa_reference = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    seller = relationship("Seller", back_populates="withdrawals")

# Delivery Assignment Model
class DeliveryAssignment(Base):
    __tablename__ = "delivery_assignments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=False)
    status = Column(String, default="assigned")  # assigned, picked_up, delivered
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Notification Enums
class NotificationType(str, enum.Enum):
    ORDER = "order"
    PAYMENT = "payment"
    DELIVERY = "delivery"
    ISSUE = "issue"
    PROMOTION = "promotion"
    SYSTEM = "system"

class NotificationStatus(str, enum.Enum):
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"

class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in-app"

# Notification Model
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # order, payment, delivery, issue, promotion, system
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default=NotificationStatus.UNREAD)  # unread, read, archived
    action_url = Column(String)
    action_label = Column(String)
    data = Column(JSON)  # Extra metadata (orderId, etc.)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

# Notification Preferences Model
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False, unique=True, index=True)
    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    in_app_notifications = Column(Boolean, default=True)
    order_updates = Column(Boolean, default=True)
    payment_updates = Column(Boolean, default=True)
    delivery_updates = Column(Boolean, default=True)
    promotions = Column(Boolean, default=True)
    system_alerts = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

# Notification Log Model (for tracking delivery attempts)
class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    notification_id = Column(String, ForeignKey("notifications.id"), nullable=False)
    channel = Column(String, nullable=False)  # email, sms, push
    status = Column(String, nullable=False)  # pending, sent, failed, bounced
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Device Token Model (for push notifications)
class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    device_type = Column(String)  # ios, android, web
    device_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

# Real-time Event Log Model
class RealtimeEvent(Base):
    __tablename__ = "realtime_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # order_update, delivery_update, notification, connection, etc.
    event_data = Column(JSON, nullable=False)
    order_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    processed = Column(Boolean, default=False)

    user = relationship("User")

# Rider-related enums
class RiderAvailabilityStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    ON_DELIVERY = "on_delivery"

class WithdrawalMethod(str, enum.Enum):
    MPESA = "mpesa"
    BANK = "bank"

class WithdrawalStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    REJECTED = "rejected"

class RiderDeliveryStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# Rider Model
class Rider(Base):
    __tablename__ = "riders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    phone = Column(String, nullable=False)
    vehicle_type = Column(String)
    vehicle_plate = Column(String)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    current_lat = Column(Float)
    current_lng = Column(Float)
    bank_account = Column(String)
    bank_name = Column(String)
    mpesa_number = Column(String)
    mpesa_verified = Column(Boolean, default=False)
    availability_status = Column(String, default=RiderAvailabilityStatus.OFFLINE)
    total_deliveries = Column(Integer, default=0)
    completed_deliveries = Column(Integer, default=0)
    average_rating = Column(Float, default=5.0)
    response_time_minutes = Column(Integer, default=0)
    on_time_percentage = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    earnings = relationship("RiderEarnings", back_populates="rider")
    withdrawals = relationship("RiderWithdrawal", back_populates="rider")

# Rider Earnings Model
class RiderEarnings(Base):
    __tablename__ = "rider_earnings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    rider_id = Column(String, ForeignKey("riders.id"), nullable=False)
    delivery_id = Column(String, nullable=False)
    base_fee = Column(Float, nullable=False)
    distance_bonus = Column(Float, default=0.0)
    speed_bonus = Column(Float, default=0.0)
    rating_bonus = Column(Float, default=0.0)
    total_earned = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rider = relationship("Rider", back_populates="earnings")

# Rider Withdrawal Model
class RiderWithdrawal(Base):
    __tablename__ = "rider_withdrawals"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    rider_id = Column(String, ForeignKey("riders.id"), nullable=False)
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)
    status = Column(String, default=WithdrawalStatus.PENDING)
    requested_date = Column(DateTime, default=datetime.utcnow, index=True)
    completed_date = Column(DateTime)
    transaction_id = Column(String)
    reason_rejected = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rider = relationship("Rider", back_populates="withdrawals")

# Shop Review Model (for shop-level reviews, not order-based)
class ShopReview(Base):
    __tablename__ = "shop_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("user.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    review = Column(Text)  # Review text
    display_name = Column(String)  # Name to display (can be different from user name)
    reviewer_email = Column(String)  # Store email to check for duplicates
    is_verified_purchase = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seller = relationship("Seller")
    user = relationship("User")

# Shop Feedback Model
class ShopFeedback(Base):
    __tablename__ = "shop_feedback"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("user.id"), nullable=True, index=True)
    feedback_text = Column(Text, nullable=False)
    display_name = Column(String)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seller = relationship("Seller")
    user = relationship("User")

# Shop Follow Model
class ShopFollow(Base):
    __tablename__ = "shop_follows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("user.id"), nullable=False, index=True)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
    seller = relationship("Seller")
