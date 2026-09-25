from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional
import requests
import base64
from datetime import datetime

from database import get_db
from models import Payment, Order, User, Seller
from schemas import MPesaPaymentRequest, PaymentStatusResponse, RefundRequest
from config import settings
from app.api.deps import get_current_user

# DISABLED: This router creates guest users. Use app/api/api_v1/endpoints/payments.py instead
# router = APIRouter(prefix="/payments", tags=["payments"])
router = APIRouter(prefix="/payments-disabled", tags=["payments"])

# M-Pesa Daraja Integration
class MPesaService:
    def __init__(self):
        self.consumer_key = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.business_shortcode = settings.MPESA_BUSINESS_SHORTCODE
        self.passkey = settings.MPESA_PASSKEY
        self.environment = settings.MPESA_ENVIRONMENT
        self.callback_url = settings.MPESA_CALLBACK_URL
        self.base_url = "https://sandbox.safaricom.co.ke" if self.environment == "sandbox" else "https://api.safaricom.co.ke"

    def get_access_token(self):
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        try:
            response = requests.get(
                url,
                auth=(self.consumer_key, self.consumer_secret),
                timeout=10,
                verify=True
            )
            if response.status_code == 200:
                return response.json()["access_token"]
            else:
                raise Exception(f"M-Pesa auth failed: {response.status_code} - {response.text}")
        except Exception as e:
            raise Exception(f"Failed to get M-Pesa access token: {str(e)}")

    def initiate_stk_push(self, phone_number: str, amount: float, order_id: str, account_reference: str):
        access_token = self.get_access_token()

        # Format phone number: remove +, leading 0, ensure 254 prefix
        phone = phone_number.replace("+", "").lstrip("0")
        if not phone.startswith("254"):
            phone = "254" + phone

        print(f"[MPesaService] Formatted phone: {phone_number} -> {phone}")

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password_string = f"{self.business_shortcode}{self.passkey}{timestamp}"
        password = base64.b64encode(password_string.encode()).decode()

        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        headers = {"Authorization": f"Bearer {access_token}"}
        payload = {
            "BusinessShortCode": self.business_shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": phone,
            "PartyB": self.business_shortcode,
            "PhoneNumber": phone,
            "CallBackURL": self.callback_url,
            "AccountReference": account_reference,
            "TransactionDesc": f"Payment for order {order_id}"
        }

        response = requests.post(url, json=payload, headers=headers, timeout=10)
        return response.json()

mpesa_service = MPesaService()

@router.post("/mpesa")
def initiate_mpesa_checkout(
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Handle M-Pesa payment from checkout page
    Creates order and payment, ready for simulation
    """
    try:
        phone_number = body.get('phoneNumber') or body.get('phone_number')
        amount = body.get('amount')
        order_id = body.get('orderId') or body.get('order_id')
        items = body.get('items', [])
        location = body.get('location')
        delivery_address = body.get('deliveryAddress', location)
        delivery_option = body.get('deliveryOption', 'delivery')
        courier_tip = body.get('courierTip', 0)

        if not phone_number or not amount or not order_id:
            raise HTTPException(status_code=400, detail="Missing required fields")

        print(f"[M-Pesa] Processing checkout: {phone_number}, {amount}, {order_id}")

        # Generate mock checkout request ID
        import hashlib
        import uuid as uuid_module
        mock_id = hashlib.md5(f"{order_id}{phone_number}".encode()).hexdigest()[:16].upper()
        db_order_id = f"ORD-{uuid_module.uuid4().hex[:12]}"

        # Create order and payment
        try:
            from models import OrderItem, OrderStatus, User as BackendUser
            import uuid as uuid_module

            # Create user ID for guest or authenticated user
            user_id_str = f"guest_{uuid_module.uuid4().hex[:8]}"

            # Ensure user exists in backend users table
            backend_user = db.query(BackendUser).filter(BackendUser.id == user_id_str).first()

            if not backend_user:
                # Create user in backend users table
                backend_user = BackendUser(
                    id=user_id_str,
                    email=f"guest_{uuid_module.uuid4().hex[:8]}@suqafuran.local",
                    phone=phone_number,
                    full_name="Guest User"
                )
                db.add(backend_user)
                db.flush()

            # Ensure seller exists
            seller = db.query(Seller).filter(Seller.id == "guest-seller").first()
            if not seller:
                seller = Seller(
                    id="guest-seller",
                    user_id=user_id_str,
                    shop_name="Guest Shop",
                    description="Guest Seller"
                )
                db.add(seller)
                db.flush()

            # Create order with authenticated user
            order = Order(
                id=db_order_id,
                user_id=user_id_str,
                seller_id="guest-seller",
                phone_number=phone_number,
                delivery_address=delivery_address,
                location_lat=0.0,
                location_lng=0.0,
                delivery_option=delivery_option,
                total_amount=amount,
                platform_fee=amount * 0.05,
                seller_amount=amount * 0.95,
                courier_tip=courier_tip,
                status=OrderStatus.PAYMENT_PENDING,
                payment_status="pending",
                payment_method="mpesa"  # Set payment method to M-Pesa
            )
            db.add(order)

            # Add order items
            for item in items:
                order_item = OrderItem(
                    order_id=db_order_id,
                    product_id=item.get('id', ''),
                    title=item.get('title', ''),
                    quantity=item.get('quantity', 1),
                    price=item.get('price', 0)
                )
                db.add(order_item)

            # Create payment
            payment = Payment(
                order_id=db_order_id,
                amount=amount,
                status="pending",
                merchant_request_id=f"MOCK_{mock_id}",
                checkout_request_id=f"MOCK_{mock_id}"
            )
            db.add(payment)
            db.commit()
            print(f"[M-Pesa] Order and payment created: {db_order_id}")
        except Exception as db_error:
            db.rollback()
            print(f"[M-Pesa] Database error: {db_error}")
            raise HTTPException(status_code=500, detail=f"Failed to create order: {str(db_error)}")

        return {
            "success": True,
            "message": "STK push initiated",
            "merchant_request_id": f"MOCK_{mock_id}",
            "checkout_request_id": f"MOCK_{mock_id}",
            "order_id": db_order_id,
            "response_code": "0",
            "response_description": "The service request has been accepted successfully.",
            "customer_message": "Please complete the payment on your phone",
            "simulation_mode": True,
            "phone": phone_number,
            "amount": amount,
            "simulate_url": f"http://localhost:8000/api/v1/payments/mpesa/simulate?checkout_request_id=MOCK_{mock_id}&success=true"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[M-Pesa] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Payment initiation failed: {str(e)}")

@router.post("/mpesa/initiate")
def initiate_mpesa_payment(
    payment_data: MPesaPaymentRequest,
    db: Session = Depends(get_db)
):
    # Get order
    order = db.query(Order).filter(Order.id == payment_data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if payment already exists
    existing_payment = db.query(Payment).filter(Payment.order_id == payment_data.order_id).first()
    if existing_payment and existing_payment.status == "completed":
        raise HTTPException(status_code=400, detail="Payment already completed")

    try:
        # Initiate STK push
        result = mpesa_service.initiate_stk_push(
            payment_data.phone_number,
            payment_data.amount,
            payment_data.order_id,
            payment_data.account_reference
        )

        if result.get("ResponseCode") == "0":
            # Create/update payment record
            payment = Payment(
                order_id=payment_data.order_id,
                amount=payment_data.amount,
                status="pending",
                merchant_request_id=result.get("MerchantRequestID"),
                checkout_request_id=result.get("CheckoutRequestID")
            )
            db.add(payment)
            db.commit()
            db.refresh(payment)

            return {
                "success": True,
                "merchant_request_id": result.get("MerchantRequestID"),
                "checkout_request_id": result.get("CheckoutRequestID"),
                "response_code": result.get("ResponseCode"),
                "response_description": result.get("ResponseDescription"),
                "customer_message": result.get("CustomerMessage")
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("ResponseDescription", "Payment initiation failed"))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mpesa/callback", include_in_schema=False)
def mpesa_callback(db: Session = Depends(get_db)):
    # This would be called by M-Pesa service
    # Implement proper callback handling
    return {"success": True}

@router.post("/mpesa/callback", include_in_schema=False)
def mpesa_callback_post(body: dict = Body(...), db: Session = Depends(get_db)):
    """
    M-Pesa callback endpoint for STK push responses
    """
    try:
        stk_callback = body.get("Body", {}).get("stkCallback", {})
        checkout_request_id = stk_callback.get("CheckoutRequestID")
        result_code = stk_callback.get("ResultCode")

        # Find payment by checkout_request_id
        payment = db.query(Payment).filter(
            Payment.checkout_request_id == checkout_request_id
        ).first()

        if not payment:
            return {"success": False, "message": "Payment not found"}

        if result_code == 0:
            # Payment successful
            metadata = stk_callback.get("CallbackMetadata", {}).get("Item", [])
            mpesa_ref = None
            amount = None

            for item in metadata:
                if item.get("Name") == "MpesaReceiptNumber":
                    mpesa_ref = item.get("Value")
                elif item.get("Name") == "Amount":
                    amount = item.get("Value")

            # Update payment status
            payment.status = "completed"
            payment.mpesa_reference = mpesa_ref
            payment.updated_at = datetime.utcnow()

            # Update order status
            order = db.query(Order).filter(Order.id == payment.order_id).first()
            if order:
                order.payment_status = "completed"
                order.payment_reference = mpesa_ref
                order.status = "confirmed"
                order.updated_at = datetime.utcnow()

            db.commit()
            return {"success": True, "message": "Payment processed"}
        else:
            # Payment failed
            payment.status = "failed"
            payment.updated_at = datetime.utcnow()

            order = db.query(Order).filter(Order.id == payment.order_id).first()
            if order:
                order.payment_status = "failed"
                order.status = "cancelled"

            db.commit()
            return {"success": True, "message": "Payment failed"}

    except Exception as e:
        return {"success": False, "message": str(e)}

@router.get("/{order_id}/status", response_model=PaymentStatusResponse)
def check_payment_status(
    order_id: str,
    db: Session = Depends(get_db)
):
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    return {
        "order_id": payment.order_id,
        "status": payment.status,
        "amount": payment.amount,
        "mpesa_reference": payment.mpesa_reference,
        "payment_method": "mpesa",
        "created_at": payment.created_at,
        "updated_at": payment.updated_at
    }

@router.post("/mpesa/simulate")
def simulate_mpesa_payment(
    checkout_request_id: str,
    success: bool = True,
    db: Session = Depends(get_db)
):
    """
    Simulate M-Pesa payment for testing.
    """
    try:
        # Try to find and update payment in database
        print(f"[Simulate] Looking for payment with checkout_request_id: {checkout_request_id}")
        payment = db.query(Payment).filter(
            Payment.checkout_request_id == checkout_request_id
        ).first()

        print(f"[Simulate] Payment found: {payment is not None}")
        if payment:
            print(f"[Simulate] Updating payment status to 'completed'")
            if success:
                payment.status = "completed"
                payment.mpesa_reference = f"SIM{checkout_request_id[:8].upper()}"
                payment.updated_at = datetime.utcnow()

                print(f"[Simulate] Looking for order: {payment.order_id}")
                order = db.query(Order).filter(Order.id == payment.order_id).first()
                print(f"[Simulate] Order found: {order is not None}")
                if order:
                    order.payment_status = "completed"
                    order.payment_reference = payment.mpesa_reference
                    order.status = "confirmed"
                    order.updated_at = datetime.utcnow()
                    print(f"[Simulate] Updated order status to 'confirmed'")
                print(f"[Simulate] Committing transaction...")
                db.commit()
                print(f"[Simulate] Commit successful")
                return {
                    "success": True,
                    "message": "Payment simulated successfully",
                    "mpesa_reference": payment.mpesa_reference
                }
            else:
                payment.status = "failed"
                payment.updated_at = datetime.utcnow()
                order = db.query(Order).filter(Order.id == payment.order_id).first()
                if order:
                    order.payment_status = "failed"
                    order.status = "cancelled"
                    order.updated_at = datetime.utcnow()
                db.commit()
                return {"success": False, "message": "Payment simulation failed"}
    except Exception as db_error:
        print(f"[Simulate] Database error: {db_error}")
        import traceback
        traceback.print_exc()

    # Return success for testing even if database fails
    # Also mark associated order as confirmed
    try:
        order = db.query(Order).filter(
            Order.id.like(f"%{checkout_request_id[:8]}%")
        ).first()
        if order:
            order.status = "confirmed"
            order.payment_status = "completed"
            order.payment_reference = f"SIM{checkout_request_id[:8].upper()}"
            order.updated_at = datetime.utcnow()
            db.commit()
    except Exception as e:
        print(f"[Simulate] Could not update order: {e}")
    
    return {
        "success": True,
        "message": "Payment simulated successfully",
        "mpesa_reference": f"SIM{checkout_request_id[:8].upper() if checkout_request_id else 'TEST'}",
        "checkout_request_id": checkout_request_id
    }


@router.post("/{order_id}/refund")
def refund_payment(
    order_id: str,
    refund_data: RefundRequest,
    db: Session = Depends(get_db)
):
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status != "completed":
        raise HTTPException(status_code=400, detail="Can only refund completed payments")

    refund_amount = refund_data.amount or payment.amount

    # Create refund record
    # TODO: Implement M-Pesa refund API call
    payment.status = "refunded"
    payment.updated_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "refund_reference": f"REF{payment.id}",
        "amount": refund_amount
    }
