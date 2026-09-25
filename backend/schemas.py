from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Auth Schemas
class UserSignup(BaseModel):
    email: EmailStr
    phone: str
    full_name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[dict]

# User Schemas
class UserResponse(BaseModel):
    id: str
    email: str
    phone: str
    full_name: str
    is_active: bool
    is_verified: bool
    created_at: datetime

# Seller Schemas
class SellerRegister(BaseModel):
    shop_name: str
    owner_name: str
    email: EmailStr
    phone: str
    mpesa_number: str
    shop_address: str
    category: str
    location: dict  # {latitude, longitude}

class SellerUpdate(BaseModel):
    shop_name: Optional[str] = None
    shop_address: Optional[str] = None

class SellerResponse(BaseModel):
    id: str
    shop_name: str
    owner_name: str
    email: str
    phone: str
    mpesa_number: str
    mpesa_verified: bool
    shop_address: str
    category: str
    verification_status: str
    is_active: bool
    created_at: datetime

class MPesaVerification(BaseModel):
    mpesa_number: str

# Order Schemas
class OrderItemCreate(BaseModel):
    product_id: str
    title: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    delivery_option: str  # delivery or pickup
    delivery_address: Optional[str] = None
    scheduled_time: Optional[str] = None
    phone_number: str
    courier_tip: float = 0
    promo_code: Optional[str] = None
    location: dict  # {latitude, longitude}

class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    title: str
    quantity: int
    price: float

class OrderResponse(BaseModel):
    id: str
    user_id: str
    seller_id: str
    status: str
    delivery_option: str
    delivery_address: Optional[str]
    phone_number: str
    total_amount: float
    platform_fee: float
    seller_amount: float
    courier_tip: float
    payment_status: str
    items: List[OrderItemResponse]
    created_at: datetime
    updated_at: datetime

class OrderStatusUpdate(BaseModel):
    status: str

# Payment Schemas
class MPesaPaymentRequest(BaseModel):
    phone_number: str
    amount: float
    order_id: str
    account_reference: str
    transaction_description: str

class PaymentStatusResponse(BaseModel):
    order_id: str
    status: str
    amount: float
    mpesa_reference: Optional[str]
    payment_method: str
    created_at: datetime

class RefundRequest(BaseModel):
    amount: Optional[float] = None

# Issue Schemas
class IssueReport(BaseModel):
    issue_type: str  # item_mismatch, damaged, missing_items, other
    description: str
    images: Optional[List[str]] = None

class ResolutionRequest(BaseModel):
    resolution_type: str  # refund or replacement

# Rating Schema
class RatingSubmit(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

# Earnings Schema
class EarningsResponse(BaseModel):
    total_earnings: float
    platform_fees: float
    net_earnings: float
    transactions: List[dict]

class WithdrawalRequest(BaseModel):
    amount: float

class WithdrawalResponse(BaseModel):
    id: str
    amount: float
    status: str
    created_at: datetime

# Rider Schemas
class RiderRegister(BaseModel):
    phone: str
    vehicle_type: str  # motorcycle, car, bicycle
    vehicle_plate: str

class RiderResponse(BaseModel):
    id: str
    phone: str
    vehicle_type: str
    vehicle_plate: str
    is_verified: bool
    is_active: bool
    current_lat: Optional[float]
    current_lng: Optional[float]
    created_at: datetime

class RiderLocationUpdate(BaseModel):
    latitude: float
    longitude: float

class DeliveryAssignmentResponse(BaseModel):
    id: str
    order_id: str
    rider_id: str
    status: str
    created_at: datetime

class DeliveryStatusUpdate(BaseModel):
    status: str

# Notification Schemas
class NotificationCreate(BaseModel):
    type: str  # order, payment, delivery, issue, promotion, system
    title: str
    message: str
    channels: List[str] = ["in-app"]  # email, sms, push, in-app
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    data: Optional[dict] = None

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    status: str
    action_url: Optional[str]
    action_label: Optional[str]
    data: Optional[dict]
    created_at: datetime
    updated_at: datetime

class NotificationListResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    status: str
    created_at: datetime

class NotificationPreferenceResponse(BaseModel):
    id: str
    user_id: str
    email_notifications: bool
    sms_notifications: bool
    push_notifications: bool
    in_app_notifications: bool
    order_updates: bool
    payment_updates: bool
    delivery_updates: bool
    promotions: bool
    system_alerts: bool

class NotificationPreferenceUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    in_app_notifications: Optional[bool] = None
    order_updates: Optional[bool] = None
    payment_updates: Optional[bool] = None
    delivery_updates: Optional[bool] = None
    promotions: Optional[bool] = None
    system_alerts: Optional[bool] = None

# WebSocket & Real-time Schemas
class DeviceTokenRegister(BaseModel):
    token: str
    device_type: str  # ios, android, web
    device_name: Optional[str] = None

class DeviceTokenResponse(BaseModel):
    id: str
    user_id: str
    device_type: str
    device_name: Optional[str]
    is_active: bool
    created_at: datetime

# Real-time Event Schemas
class OrderUpdateEvent(BaseModel):
    event_type: str = "order_update"
    order_id: str
    status: str
    message: Optional[str] = None
    data: Optional[dict] = None
    timestamp: datetime

class DeliveryUpdateEvent(BaseModel):
    event_type: str = "delivery_update"
    order_id: str
    rider_id: str
    latitude: float
    longitude: float
    eta_minutes: Optional[int] = None
    status: str
    timestamp: datetime

class NotificationEventSchema(BaseModel):
    event_type: str = "notification"
    notification_id: str
    type: str
    title: str
    message: str
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    created_at: datetime

class PaymentUpdateEvent(BaseModel):
    event_type: str = "payment_update"
    order_id: str
    status: str
    amount: float
    message: Optional[str] = None
    timestamp: datetime

class RealtimeEventLog(BaseModel):
    id: str
    user_id: str
    event_type: str
    event_data: dict
    order_id: Optional[str]
    created_at: datetime
    processed: bool
