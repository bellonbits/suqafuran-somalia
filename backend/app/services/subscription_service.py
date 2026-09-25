"""
Seller subscription management with M-Pesa integration.
Handles subscription creation, renewal, M-Pesa payments, and feature access.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlmodel import Session, select
import httpx
import base64
from app.models import (
    SellerSubscription,
    SubscriptionPlan,
    SellerBilling,
    SellerFeatureAccess,
    BillingFrequency,
    BillingStatus,
    Listing,
    IdentityVerification,
    User,
)
from app.models.verification import VerificationRequest, VerificationStatus
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger("subscription_service")


class SubscriptionService:
    """Manages seller subscriptions and M-Pesa payments."""

    def __init__(self):
        self.mpesa_base_url = "https://api.safaricom.co.ke"
        self.consumer_key = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.business_shortcode = settings.MPESA_BUSINESS_SHORTCODE
        self.lipana_secret_key = settings.LIPANA_SECRET_KEY

    def get_mpesa_access_token(self) -> str:
        """Get M-Pesa access token via OAuth."""
        auth = base64.b64encode(
            f"{self.consumer_key}:{self.consumer_secret}".encode()
        ).decode()

        headers = {"Authorization": f"Basic {auth}"}
        endpoint = f"{self.mpesa_base_url}/oauth/v1/generate?grant_type=client_credentials"

        try:
            response = httpx.get(endpoint, headers=headers, timeout=10.0)
            response.raise_for_status()
            return response.json()["access_token"]
        except Exception as e:
            logger.error(f"Failed to get M-Pesa access token: {e}")
            raise

    def initiate_payment(
        self,
        seller_id: int,
        phone_number: str,
        amount_kes: float,
        plan_id: int,
        billing_frequency: BillingFrequency,
        session: Session,
    ) -> Dict[str, Any]:
        """
        Initiate M-Pesa STK push for subscription payment.
        Returns checkout request ID and timestamp for tracking.
        """

        # Validate phone number (254XXXXXXXXX format)
        if not phone_number.startswith("254"):
            phone_number = "254" + phone_number.lstrip("0")

        # Create billing record
        due_date = datetime.utcnow() + timedelta(days=7)
        next_billing_date = (
            datetime.utcnow() + timedelta(days=30)
            if billing_frequency == BillingFrequency.MONTHLY
            else datetime.utcnow() + timedelta(days=365)
        )

        # Generate invoice number
        invoice_number = f"INV-{seller_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        billing = SellerBilling(
            seller_id=seller_id,
            subscription_id=None,  # Will be set after subscription created
            amount_kes=amount_kes,
            phone_number=phone_number,
            invoice_number=invoice_number,
            due_date=due_date,
            next_billing_date=next_billing_date,
            status="pending",
        )

        session.add(billing)
        session.commit()
        session.refresh(billing)

        # Prepare M-Pesa STK push
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{self.business_shortcode}{settings.MPESA_PASSKEY}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": self.business_shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount_kes),
            "PartyA": phone_number,
            "PartyB": self.business_shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": f"{settings.FRONTEND_URL}/api/v1/subscriptions/mpesa-callback",
            "AccountReference": invoice_number,
            "TransactionDesc": f"Suqafuran Shop Subscription - {invoice_number}",
        }

        try:
            token = self.get_mpesa_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            url = f"{self.mpesa_base_url}/mpesa/stkpush/v1/processrequest"

            response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
            response.raise_for_status()
            result = response.json()

            # Update billing record with M-Pesa response
            billing.mpesa_checkout_request_id = result.get("CheckoutRequestID")
            billing.mpesa_request_id = result.get("RequestID")
            billing.mpesa_response = result
            session.add(billing)
            session.commit()

            logger.info(
                f"STK push initiated for {phone_number}: {result.get('CheckoutRequestID')}"
            )

            return {
                "success": True,
                "checkout_request_id": result.get("CheckoutRequestID"),
                "request_id": result.get("RequestID"),
                "billing_id": billing.id,
                "message": result.get("ResponseDescription", "STK push sent"),
            }

        except Exception as e:
            billing.status = "failed"
            billing.mpesa_response = {"error": str(e)}
            session.add(billing)
            session.commit()
            logger.error(f"STK push failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "billing_id": billing.id,
            }

    def verify_payment(
        self, checkout_request_id: str, session: Session
    ) -> Dict[str, Any]:
        """
        Query M-Pesa to verify if payment was successful.
        """

        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{self.business_shortcode}{settings.MPESA_PASSKEY}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": self.business_shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id,
        }

        try:
            token = self.get_mpesa_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            url = f"{self.mpesa_base_url}/mpesa/stkpushquery/v1/query"

            response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
            response.raise_for_status()
            result = response.json()

            return result

        except Exception as e:
            logger.error(f"Payment verification failed: {e}")
            raise

    def create_subscription(
        self,
        seller_id: int,
        plan_id: int,
        billing_frequency: BillingFrequency,
        billing_id: int,
        is_trial: bool = False,
        session: Optional[Session] = None,
    ) -> SellerSubscription:
        """Create a new subscription for a shop."""

        if session is None:
            from app.db.session import SessionLocal

            session = SessionLocal()

        # Calculate dates
        trial_started_at = None
        trial_ends_at = None
        current_period_start = datetime.utcnow()
        current_period_end = datetime.utcnow()

        if is_trial:
            plan = session.exec(select(SubscriptionPlan).where(
                SubscriptionPlan.id == plan_id
            )).first()
            trial_days = plan.trial_days if plan else 7
            trial_started_at = datetime.utcnow()
            trial_ends_at = datetime.utcnow() + timedelta(days=trial_days)
            current_period_end = trial_ends_at
        else:
            if billing_frequency == BillingFrequency.MONTHLY:
                current_period_end = datetime.utcnow() + timedelta(days=30)
            else:  # Annual
                current_period_end = datetime.utcnow() + timedelta(days=365)

        subscription = SellerSubscription(
            seller_id=seller_id,
            plan_id=plan_id,
            billing_frequency=billing_frequency,
            trial_started_at=trial_started_at,
            trial_ends_at=trial_ends_at,
            is_trial_active=is_trial,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            renews_at=current_period_end,
            status=BillingStatus.ACTIVE,
            is_active=True,
        )

        session.add(subscription)
        session.commit()
        session.refresh(subscription)

        # Update billing record with subscription
        billing = session.exec(select(SellerBilling).where(
            SellerBilling.id == billing_id
        )).first()
        if billing:
            billing.subscription_id = subscription.id
            session.add(billing)
            session.commit()

        # Create feature access record
        plan = session.exec(select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id
        )).first()

        if plan:
            feature_access = SellerFeatureAccess(
                seller_id=seller_id,
                subscription_id=subscription.id,
                has_analytics=plan.has_analytics,
                has_verified_badge=plan.has_verified_badge,
                has_priority_ranking=plan.has_priority_ranking,
                has_custom_branding=plan.has_custom_branding,
                has_bulk_import=plan.has_bulk_import,
                has_marketing_codes=plan.has_marketing_codes,
                has_staff_accounts=plan.has_staff_accounts,
                has_email_support=plan.has_email_support,
                has_priority_support=plan.has_priority_support,
                max_products=plan.max_products,
                max_staff_accounts=plan.max_staff_accounts,
            )
            session.add(feature_access)
            session.commit()

        logger.info(f"Created subscription for {seller_id}: {subscription.id}")
        return subscription

    def get_seller_features(
        self, seller_id: int, session: Session
    ) -> Optional[SellerFeatureAccess]:
        """Get feature access for a seller."""

        features = session.exec(
            select(SellerFeatureAccess).where(
                SellerFeatureAccess.seller_id == seller_id
            )
        ).first()

        return features

    def can_add_products(
        self, seller_id: int, session: Session
    ) -> bool:
        """Check if seller can add more products based on plan."""

        features = self.get_seller_features(seller_id, session)
        if not features or features.max_products is None:
            return True  # Unlimited

        # Count current products
        from app.models import Listing

        count = session.exec(
            select(Listing).where(Listing.owner_id == seller_id).where(
                Listing.is_active == True
            )
        ).all()

        return len(count) < features.max_products

    def handle_mpesa_callback(
        self, body: Dict[str, Any], session: Session
    ) -> bool:
        """
        Handle M-Pesa callback to confirm payment.
        Called by M-Pesa after STK push is confirmed/denied.
        """

        try:
            result = body.get("Body", {})
            callback_data = result.get("stkCallback", {})
            checkout_id = callback_data.get("CheckoutRequestID")
            result_code = callback_data.get("ResultCode")

            # Find billing record
            billing = session.exec(
                select(SellerBilling).where(
                    SellerBilling.mpesa_checkout_request_id == checkout_id
                )
            ).first()

            if not billing:
                logger.error(f"Billing record not found for {checkout_id}")
                return False

            if result_code == 0:  # Success
                billing.status = "success"
                billing.payment_date = datetime.utcnow()

                # Update subscription if not already created
                if billing.subscription_id is None:
                    # Find pending subscription
                    subscription = session.exec(
                        select(SellerSubscription).where(
                            SellerSubscription.seller_id == billing.seller_id
                        ).where(SellerSubscription.status == BillingStatus.PENDING)
                    ).first()

                    if subscription:
                        subscription.status = BillingStatus.ACTIVE
                        session.add(subscription)

                logger.info(f"Payment confirmed for billing {billing.id}")
            else:
                billing.status = "failed"
                logger.error(
                    f"Payment failed for {checkout_id}: {callback_data.get('ResultDesc')}"
                )

            billing.mpesa_response = callback_data
            session.add(billing)
            session.commit()
            return result_code == 0

        except Exception as e:
            logger.error(f"Error processing M-Pesa callback: {e}")
            raise

    def auto_verify_existing_sellers(self, seller_id: int, session: Session) -> dict:
        """
        Auto-verify sellers based on:
        1. Already approved VerificationRequest (passed document verification)
        2. Has existing listings on platform (already vetted seller)
        Returns: {auto_verified: bool, reason: str, verification_data: dict}
        """
        try:
            verification_data = {}

            # Check 1: Has approved VerificationRequest from existing verification system
            approved_verification = session.exec(
                select(VerificationRequest)
                .where(VerificationRequest.user_id == seller_id)
                .where(VerificationRequest.status == VerificationStatus.APPROVED)
            ).first()

            if approved_verification:
                verification_data = {
                    "type": "existing_verification",
                    "verification_id": approved_verification.id,
                    "document_type": approved_verification.document_type,
                    "tier": approved_verification.tier,
                    "verified_at": approved_verification.updated_at,
                    "auto_verification_status": approved_verification.auto_verification_status,
                }
                logger.info(
                    f"Seller {seller_id} has approved VerificationRequest (tier {approved_verification.tier})"
                )

            # Check 2: Has existing listings (shop owner on platform)
            has_listings = session.exec(
                select(Listing).where(Listing.owner_id == seller_id).limit(1)
            ).first()

            if has_listings:
                verification_data["has_listings"] = True
                verification_data["reason_for_approval"] = "existing shop owner"
                logger.info(f"Seller {seller_id} has existing listings on platform")
            else:
                verification_data["has_listings"] = False

            # Auto-approve if EITHER condition is true
            should_auto_approve = approved_verification is not None or has_listings is not None

            if not should_auto_approve:
                return {
                    "auto_verified": False,
                    "reason": "New seller without verification or listings",
                    "verification_data": verification_data,
                }

            # Auto-approve: Create or update IdentityVerification record
            verification = session.exec(
                select(IdentityVerification).where(
                    IdentityVerification.seller_id == seller_id
                )
            ).first()

            if not verification:
                verification = IdentityVerification(
                    seller_id=seller_id,
                    status="approved",
                    verified_at=datetime.utcnow(),
                    phone_verified=True,
                    email_verified=True,
                    id_type=approved_verification.document_type if approved_verification else "shop_owner",
                    id_number=approved_verification.id_number if approved_verification else None,
                )
                session.add(verification)
            else:
                verification.status = "approved"
                verification.verified_at = datetime.utcnow()
                verification.phone_verified = True
                verification.email_verified = True
                if approved_verification and not verification.id_type:
                    verification.id_type = approved_verification.document_type
                    verification.id_number = approved_verification.id_number
                session.add(verification)

            # Update user's is_verified flag
            user = session.exec(
                select(User).where(User.id == seller_id)
            ).first()

            if user:
                user.is_verified = True
                session.add(user)

            session.commit()

            reason = "approved verification" if approved_verification else "existing shop owner"
            logger.info(f"Auto-verified seller {seller_id} ({reason})")

            return {
                "auto_verified": True,
                "reason": reason,
                "verification_data": verification_data,
            }

        except Exception as e:
            logger.error(f"Error auto-verifying seller {seller_id}: {e}")
            return {
                "auto_verified": False,
                "reason": f"Error: {str(e)}",
                "verification_data": {},
            }


# Singleton instance
subscription_service = SubscriptionService()
