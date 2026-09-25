"""
M-Pesa Integration Service
Handles M-Pesa STK Push, B2C payments, and withdrawal processing
"""

import requests
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple
from requests.auth import HTTPBasicAuth
from config import settings

logger = logging.getLogger(__name__)


class MPesaService:
    """M-Pesa payment service integration"""

    # M-Pesa API Endpoints
    AUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    STK_PUSH_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    B2C_URL = "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest"
    TRANSACTION_STATUS_URL = "https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query"
    QUERY_BALANCE_URL = "https://sandbox.safaricom.co.ke/mpesa/accountbalance/v1/query"

    def __init__(self):
        """Initialize M-Pesa service with credentials"""
        self.consumer_key = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.business_shortcode = settings.MPESA_BUSINESS_SHORTCODE
        self.passkey = settings.MPESA_PASSKEY
        self.environment = settings.MPESA_ENVIRONMENT
        self.callback_url = settings.MPESA_CALLBACK_URL
        self.access_token = None
        self.token_expiry = None

    def get_access_token(self) -> Optional[str]:
        """Get M-Pesa OAuth access token"""
        try:
            response = requests.get(
                self.AUTH_URL,
                auth=HTTPBasicAuth(self.consumer_key, self.consumer_secret)
            )
            response.raise_for_status()

            data = response.json()
            self.access_token = data.get("access_token")
            self.token_expiry = datetime.now().timestamp() + data.get("expires_in", 3600)

            logger.info("M-Pesa access token obtained successfully")
            return self.access_token

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get M-Pesa access token: {str(e)}")
            return None

    def _ensure_token(self) -> bool:
        """Ensure valid access token exists"""
        if not self.access_token or datetime.now().timestamp() > self.token_expiry:
            return self.get_access_token() is not None
        return True

    def initiate_stk_push(
        self,
        phone_number: str,
        amount: float,
        order_id: str,
        account_reference: str = "SUQAFURAN"
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Initiate STK Push for customer payment

        Args:
            phone_number: Customer phone (e.g., 254712345678)
            amount: Payment amount in KSh
            order_id: Unique order identifier
            account_reference: Reference shown to customer

        Returns:
            (success, message, checkout_request_id)
        """
        if not self._ensure_token():
            return False, "Failed to authenticate with M-Pesa", None

        try:
            # Calculate timestamp and password
            import base64
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            password = base64.b64encode(
                f"{self.business_shortcode}{self.passkey}{timestamp}".encode()
            ).decode()

            payload = {
                "BusinessShortCode": self.business_shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": int(amount),
                "PartyA": phone_number,
                "PartyB": self.business_shortcode,
                "PhoneNumber": phone_number,
                "CallBackURL": self.callback_url,
                "AccountReference": account_reference,
                "TransactionDesc": f"Payment for order {order_id}"
            }

            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }

            response = requests.post(
                self.STK_PUSH_URL,
                json=payload,
                headers=headers,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            if data.get("ResponseCode") == "0":
                checkout_request_id = data.get("CheckoutRequestID")
                logger.info(f"STK Push initiated: {checkout_request_id}")
                return True, "STK Push initiated successfully", checkout_request_id
            else:
                error_msg = data.get("ResponseDescription", "Unknown error")
                logger.error(f"STK Push failed: {error_msg}")
                return False, error_msg, None

        except Exception as e:
            logger.error(f"STK Push error: {str(e)}")
            return False, str(e), None

    def send_b2c_payment(
        self,
        amount: float,
        phone_number: str,
        withdrawal_id: str,
        party_a: str = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Send B2C payment for rider withdrawal

        Args:
            amount: Amount in KSh
            phone_number: Recipient phone (e.g., 254712345678)
            withdrawal_id: Withdrawal request ID
            party_a: Sender shortcode (uses business shortcode if not provided)

        Returns:
            (success, message, transaction_id)
        """
        if not self._ensure_token():
            return False, "Failed to authenticate with M-Pesa", None

        try:
            party_a = party_a or self.business_shortcode

            payload = {
                "OriginatorConversationID": f"WITHDRAWAL_{withdrawal_id}",
                "InitiatorName": "SUQAFURAN",
                "SecurityCredential": self._encrypt_credentials(),
                "CommandID": "BusinessPayment",
                "Amount": int(amount),
                "PartyA": party_a,
                "PartyB": phone_number,
                "Remarks": f"Withdrawal {withdrawal_id}",
                "QueueTimeoutURL": f"{self.callback_url}/timeout",
                "ResultURL": f"{self.callback_url}/result"
            }

            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }

            response = requests.post(
                self.B2C_URL,
                json=payload,
                headers=headers,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            if data.get("ResponseCode") == "0":
                transaction_id = data.get("ConversationID")
                logger.info(f"B2C Payment sent: {transaction_id}")
                return True, "Payment sent successfully", transaction_id
            else:
                error_msg = data.get("ResponseDescription", "Unknown error")
                logger.error(f"B2C Payment failed: {error_msg}")
                return False, error_msg, None

        except Exception as e:
            logger.error(f"B2C Payment error: {str(e)}")
            return False, str(e), None

    def check_transaction_status(
        self,
        checkout_request_id: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Check status of STK Push transaction

        Args:
            checkout_request_id: The ID from STK Push initiation

        Returns:
            (success, message, transaction_data)
        """
        if not self._ensure_token():
            return False, "Failed to authenticate with M-Pesa", None

        try:
            import base64
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            password = base64.b64encode(
                f"{self.business_shortcode}{self.passkey}{timestamp}".encode()
            ).decode()

            payload = {
                "BusinessShortCode": self.business_shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "CheckoutRequestID": checkout_request_id
            }

            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }

            response = requests.post(
                "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
                json=payload,
                headers=headers,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            if data.get("ResponseCode") == "0":
                result_code = data.get("ResultCode")
                if result_code == "0":
                    logger.info(f"Transaction successful: {checkout_request_id}")
                    return True, "Payment completed", data
                else:
                    logger.warning(f"Transaction pending/failed: {result_code}")
                    return False, "Transaction not completed", data
            else:
                error_msg = data.get("ResponseDescription", "Unknown error")
                logger.error(f"Status check failed: {error_msg}")
                return False, error_msg, None

        except Exception as e:
            logger.error(f"Status check error: {str(e)}")
            return False, str(e), None

    def query_account_balance(self) -> Tuple[bool, str, Optional[float]]:
        """
        Query M-Pesa account balance

        Returns:
            (success, message, balance)
        """
        if not self._ensure_token():
            return False, "Failed to authenticate with M-Pesa", None

        try:
            payload = {
                "CommandID": "GetAccount",
                "PartyA": self.business_shortcode,
                "IdentifierType": 4,
                "Remarks": "Balance check",
                "InitiatorName": "SUQAFURAN",
                "SecurityCredential": self._encrypt_credentials(),
                "QueueTimeoutURL": f"{self.callback_url}/timeout",
                "ResultURL": f"{self.callback_url}/result"
            }

            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }

            response = requests.post(
                self.QUERY_BALANCE_URL,
                json=payload,
                headers=headers,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            if data.get("ResponseCode") == "0":
                logger.info("Account balance queried successfully")
                # Balance is in the result callback
                return True, "Balance retrieved", None
            else:
                error_msg = data.get("ResponseDescription", "Unknown error")
                logger.error(f"Balance query failed: {error_msg}")
                return False, error_msg, None

        except Exception as e:
            logger.error(f"Balance query error: {str(e)}")
            return False, str(e), None

    def _encrypt_credentials(self) -> str:
        """Encrypt M-Pesa credentials (placeholder)"""
        # In production, implement proper encryption
        # This is a security placeholder
        import base64
        return base64.b64encode(b"encrypted_credentials").decode()

    def validate_phone_number(self, phone: str) -> bool:
        """Validate phone number format for M-Pesa"""
        # M-Pesa expects format: 254712345678
        if not phone:
            return False

        # Remove common formatting
        phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

        # Must be 12 digits starting with 254
        if phone.startswith("254") and len(phone) == 12 and phone.isdigit():
            return True

        # Convert +254 format
        if phone.startswith("+254") and len(phone) == 13 and phone[1:].isdigit():
            return True

        return False

    def format_phone_number(self, phone: str) -> str:
        """Format phone number to M-Pesa standard (254712345678)"""
        phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

        if phone.startswith("+254"):
            return phone[1:]  # Remove +
        elif phone.startswith("07"):
            return "254" + phone[1:]  # Replace 0 with 254
        elif phone.startswith("254"):
            return phone

        return phone


# Singleton instance
_mpesa_service = None


def get_mpesa_service() -> MPesaService:
    """Get or create M-Pesa service instance"""
    global _mpesa_service
    if _mpesa_service is None:
        _mpesa_service = MPesaService()
    return _mpesa_service
