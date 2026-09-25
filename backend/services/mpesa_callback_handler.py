"""
M-Pesa Callback Handler
Processes M-Pesa webhook callbacks for payments and withdrawals
"""

import json
import logging
from typing import Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class MPesaCallbackHandler:
    """Handle M-Pesa payment callbacks"""

    # Callback result codes
    RESULT_CODE_SUCCESS = 0
    RESULT_CODE_INSUFFICIENT_FUNDS = 1
    RESULT_CODE_LESS_THAN_MINIMUM = 2
    RESULT_CODE_MORE_THAN_MAXIMUM = 3
    RESULT_CODE_WOULD_EXCEED_DAILY_LIMIT = 4
    RESULT_CODE_WOULD_EXCEED_MINIMUM_BALANCE = 5
    RESULT_CODE_UNRESOLVED_PRIMARY_ROUTING_NUMBER = 6
    RESULT_CODE_UNRESOLVED_SECONDARY_ROUTING_NUMBER = 7
    RESULT_CODE_UNRESOLVED_RECIPIENT = 8
    RESULT_CODE_DUPLICATE_DETECTED = 9

    RESULT_MESSAGES = {
        0: "The service request was processed successfully.",
        1: "Insufficient Funds.",
        2: "Less than the minimum single transfer amount.",
        3: "More than the maximum single transfer amount.",
        4: "Would Exceed Daily Limit.",
        5: "Would Exceed Minimum Balance.",
        6: "Unresolved Primary Routing Number.",
        7: "Unresolved Secondary Routing Number.",
        8: "Unresolved Recipient.",
        9: "Duplicate Detected.",
    }

    @staticmethod
    def handle_stk_push_callback(callback_data: Dict, db: Session) -> bool:
        """
        Handle STK Push callback from M-Pesa

        Args:
            callback_data: Callback data from M-Pesa
            db: Database session

        Returns:
            True if processed successfully
        """
        try:
            body = callback_data.get("Body", {})
            stk_callback = body.get("stkCallback", {})

            merchant_request_id = stk_callback.get("MerchantRequestID")
            checkout_request_id = stk_callback.get("CheckoutRequestID")
            result_code = stk_callback.get("ResultCode")
            result_desc = stk_callback.get("ResultDesc")

            logger.info(
                f"STK Callback received - Checkout: {checkout_request_id}, "
                f"Result: {result_code} - {result_desc}"
            )

            if result_code == MPesaCallbackHandler.RESULT_CODE_SUCCESS:
                # Payment successful
                callback_metadata = stk_callback.get("CallbackMetadata", {})
                items = callback_metadata.get("Item", [])

                payment_data = {}
                for item in items:
                    item_name = item.get("Name")
                    item_value = item.get("Value")

                    if item_name == "Amount":
                        payment_data["amount"] = float(item_value)
                    elif item_name == "MpesaReceiptNumber":
                        payment_data["mpesa_receipt"] = str(item_value)
                    elif item_name == "TransactionDate":
                        payment_data["transaction_date"] = str(item_value)
                    elif item_name == "PhoneNumber":
                        payment_data["phone_number"] = str(item_value)

                logger.info(f"Payment successful: {payment_data}")

                # Update order payment status in database
                # TODO: Update Order table with payment info
                # order = db.query(Order).filter(Order.checkout_request_id == checkout_request_id).first()
                # if order:
                #     order.payment_status = PaymentStatus.COMPLETED
                #     order.mpesa_receipt = payment_data.get("mpesa_receipt")
                #     db.commit()

                return True
            else:
                # Payment failed
                logger.warning(
                    f"Payment failed: {result_desc} "
                    f"(Code: {result_code})"
                )
                # TODO: Update order status to failed
                return False

        except Exception as e:
            logger.error(f"Error processing STK callback: {str(e)}")
            return False

    @staticmethod
    def handle_b2c_callback(callback_data: Dict, db: Session) -> bool:
        """
        Handle B2C payment callback (withdrawal processing)

        Args:
            callback_data: Callback data from M-Pesa
            db: Database session

        Returns:
            True if processed successfully
        """
        try:
            result = callback_data.get("Result", {})

            result_type = result.get("ResultType")
            result_code = result.get("ResultCode")
            result_desc = result.get("ResultDesc")
            originator_conversation_id = result.get("OriginatorConversationID")

            logger.info(
                f"B2C Callback received - ConvID: {originator_conversation_id}, "
                f"Result: {result_code} - {result_desc}"
            )

            # Extract withdrawal ID from originator conversation ID
            # Format: WITHDRAWAL_<withdrawal_id>
            if originator_conversation_id.startswith("WITHDRAWAL_"):
                withdrawal_id = originator_conversation_id.split("_", 1)[1]

                if result_code == MPesaCallbackHandler.RESULT_CODE_SUCCESS:
                    # Withdrawal successful
                    result_parameters = result.get("ResultParameters", {})
                    parameter_items = result_parameters.get("ResultParameter", [])

                    withdrawal_data = {}
                    for param in parameter_items:
                        key = param.get("Key")
                        value = param.get("Value")

                        if key == "TransactionAmount":
                            withdrawal_data["amount"] = float(value)
                        elif key == "TransactionID":
                            withdrawal_data["transaction_id"] = str(value)
                        elif key == "TransactionReceipt":
                            withdrawal_data["receipt"] = str(value)
                        elif key == "ReceiverPartyPublicName":
                            withdrawal_data["recipient"] = str(value)

                    logger.info(f"Withdrawal successful: {withdrawal_data}")

                    # TODO: Update RiderWithdrawal table
                    # withdrawal = db.query(RiderWithdrawal).filter(
                    #     RiderWithdrawal.id == withdrawal_id
                    # ).first()
                    # if withdrawal:
                    #     withdrawal.status = WithdrawalStatus.COMPLETED
                    #     withdrawal.completed_date = datetime.utcnow()
                    #     withdrawal.transaction_id = withdrawal_data.get("transaction_id")
                    #     db.commit()

                    return True
                else:
                    # Withdrawal failed
                    reason_error = result.get("ResultParameters", {}).get("ResultParameter", [])
                    error_reason = ""

                    for param in reason_error:
                        if param.get("Key") == "ReasonType":
                            error_reason = param.get("Value")
                            break

                    logger.warning(
                        f"Withdrawal failed: {result_desc} "
                        f"(Code: {result_code}, Reason: {error_reason})"
                    )

                    # TODO: Update withdrawal status to rejected
                    # withdrawal = db.query(RiderWithdrawal).filter(
                    #     RiderWithdrawal.id == withdrawal_id
                    # ).first()
                    # if withdrawal:
                    #     withdrawal.status = WithdrawalStatus.REJECTED
                    #     withdrawal.reason_rejected = result_desc
                    #     db.commit()

                    return False

        except Exception as e:
            logger.error(f"Error processing B2C callback: {str(e)}")
            return False

    @staticmethod
    def validate_callback_signature(
        callback_data: Dict,
        webhook_secret: str
    ) -> bool:
        """
        Validate M-Pesa callback signature

        Args:
            callback_data: Callback data from M-Pesa
            webhook_secret: Webhook secret from M-Pesa

        Returns:
            True if signature is valid
        """
        import hmac
        import hashlib

        try:
            # M-Pesa sends signature in the callback
            provided_signature = callback_data.get("Signature")

            if not provided_signature:
                logger.warning("No signature provided in callback")
                return False

            # Create expected signature
            callback_json = json.dumps(callback_data, separators=(',', ':'), sort_keys=True)
            expected_signature = hmac.new(
                webhook_secret.encode(),
                callback_json.encode(),
                hashlib.sha256
            ).hexdigest()

            # Compare signatures
            if hmac.compare_digest(provided_signature, expected_signature):
                logger.info("Callback signature validated successfully")
                return True
            else:
                logger.warning("Callback signature validation failed")
                return False

        except Exception as e:
            logger.error(f"Error validating signature: {str(e)}")
            return False

    @staticmethod
    def process_timeout_callback(callback_data: Dict, db: Session) -> bool:
        """
        Handle timeout callback from M-Pesa

        Args:
            callback_data: Timeout callback data
            db: Database session

        Returns:
            True if processed
        """
        try:
            result = callback_data.get("Result", {})
            result_code = result.get("ResultCode")
            originator_conversation_id = result.get("OriginatorConversationID")

            logger.warning(
                f"M-Pesa timeout callback - ConvID: {originator_conversation_id}, "
                f"Code: {result_code}"
            )

            # Mark transaction as pending/retry
            # TODO: Update database to mark for retry

            return True

        except Exception as e:
            logger.error(f"Error processing timeout callback: {str(e)}")
            return False


class MPesaCallbackQueue:
    """Queue for processing M-Pesa callbacks asynchronously"""

    def __init__(self):
        """Initialize callback queue"""
        self.queue = []

    def enqueue(self, callback_data: Dict) -> None:
        """Add callback to queue"""
        self.queue.append({
            "data": callback_data,
            "timestamp": datetime.utcnow(),
            "processed": False
        })

    def dequeue(self) -> Optional[Dict]:
        """Get next callback from queue"""
        if self.queue:
            for item in self.queue:
                if not item["processed"]:
                    return item

        return None

    def mark_processed(self, callback_data: Dict) -> None:
        """Mark callback as processed"""
        for item in self.queue:
            if item["data"] == callback_data:
                item["processed"] = True
                break

    def retry_failed(self, max_retries: int = 3) -> None:
        """Retry failed callbacks"""
        retry_count = {}

        for item in self.queue:
            if not item["processed"]:
                conv_id = item["data"].get("Result", {}).get("OriginatorConversationID")
                retry_count[conv_id] = retry_count.get(conv_id, 0) + 1

                if retry_count[conv_id] > max_retries:
                    logger.error(f"Max retries exceeded for {conv_id}")
                    item["processed"] = True
