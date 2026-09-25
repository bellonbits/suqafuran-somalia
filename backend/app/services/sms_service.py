"""SMS service for sending SMS notifications via Africa's Talking."""

from typing import Optional
import africastalking
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger("sms_service")


class SMSService:
    """Service for sending SMS messages via Africa's Talking."""

    def __init__(self):
        """Initialize Africa's Talking client."""
        self.enabled = bool(settings.AFRICASTALKING_USERNAME and settings.AFRICASTALKING_API_KEY)

        if self.enabled:
            africastalking.initialize(
                username=settings.AFRICASTALKING_USERNAME,
                api_key=settings.AFRICASTALKING_API_KEY
            )
            self.sms = africastalking.SMS
            self.sender_id = settings.AFRICASTALKING_SENDER_ID
        else:
            self.sms = None
            self.sender_id = None
            logger.warning("SMS service not configured. Set AFRICASTALKING_* environment variables to enable.")

    def send_sms(
        self,
        to_number: str,
        message: str,
        campaign_id: Optional[int] = None
    ) -> dict:
        """
        Send SMS message to a phone number via Africa's Talking.

        Args:
            to_number: Recipient phone number (E.164 format recommended: +254...)
            message: SMS message content (max 160 chars per segment)
            campaign_id: Optional campaign ID for tracking

        Returns:
            Dict with status, message ID, and other info
        """
        if not self.enabled:
            logger.warning(f"SMS service not enabled. Would send to {to_number}")
            return {"status": "disabled", "message": "SMS service not configured"}

        if not to_number:
            return {"status": "error", "message": "Phone number required"}

        if len(message) > 1600:
            return {"status": "error", "message": "Message too long (max 1600 chars)"}

        try:
            response = self.sms.send(message, [to_number], sender=self.sender_id)

            if response["SMSMessageData"]["Message"] == "Sent":
                msg_id = response["SMSMessageData"]["Recipients"][0]["messageId"]
                logger.info(f"SMS sent to {to_number} (ID: {msg_id})" + (f" Campaign: {campaign_id}" if campaign_id else ""))

                return {
                    "status": "sent",
                    "message_id": msg_id,
                    "to": to_number,
                    "campaign_id": campaign_id,
                    "segments": (len(message) + 159) // 160  # SMS segments
                }
            else:
                error_msg = response["SMSMessageData"]["Message"]
                logger.error(f"Failed to send SMS to {to_number}: {error_msg}")
                return {"status": "error", "message": error_msg}

        except Exception as e:
            logger.error(f"Failed to send SMS to {to_number}: {e}")
            return {"status": "error", "message": str(e)}

    def send_bulk_sms(
        self,
        phone_numbers: list[str],
        message: str,
        campaign_id: Optional[int] = None
    ) -> dict:
        """
        Send SMS to multiple recipients via Africa's Talking.

        Args:
            phone_numbers: List of recipient phone numbers
            message: SMS message content
            campaign_id: Optional campaign ID for tracking

        Returns:
            Dict with success/failure counts
        """
        if not self.enabled:
            return {"status": "disabled", "message": "SMS service not configured"}

        if len(message) > 1600:
            return {"status": "error", "message": "Message too long"}

        if not phone_numbers:
            return {"status": "error", "message": "No phone numbers provided"}

        try:
            response = self.sms.send(message, phone_numbers, sender=self.sender_id)

            success_count = 0
            failure_count = 0
            results = []

            for recipient in response["SMSMessageData"]["Recipients"]:
                if recipient["statusCode"] == 101:
                    success_count += 1
                    results.append({
                        "phone": recipient["number"],
                        "status": "sent",
                        "message_id": recipient["messageId"]
                    })
                else:
                    failure_count += 1
                    results.append({
                        "phone": recipient["number"],
                        "status": "failed",
                        "error": recipient["statusMessage"]
                    })

            logger.info(f"Bulk SMS: {success_count} sent, {failure_count} failed" + (f" Campaign: {campaign_id}" if campaign_id else ""))

            return {
                "status": "completed",
                "success": success_count,
                "failed": failure_count,
                "total": len(phone_numbers),
                "campaign_id": campaign_id,
                "results": results if failure_count > 0 else None  # Only return errors
            }

        except Exception as e:
            logger.error(f"Failed to send bulk SMS: {e}")
            return {
                "status": "error",
                "message": str(e),
                "success": 0,
                "failed": len(phone_numbers)
            }

    def verify_phone_number(self, phone_number: str) -> bool:
        """
        Verify if a phone number is valid.

        Args:
            phone_number: Phone number to verify

        Returns:
            True if valid, False otherwise
        """
        if not phone_number or len(phone_number) < 10:
            return False

        # Basic validation: should contain only digits and + symbol
        import re
        return bool(re.match(r'^\+?[1-9]\d{1,14}$', phone_number))

    def format_phone_number(self, phone_number: str, country_code: str = "+254") -> str:
        """
        Format phone number to E.164 format (Africa's Talking standard).

        Args:
            phone_number: Phone number to format
            country_code: Country code (default: Kenya +254)

        Returns:
            Formatted phone number
        """
        # Remove non-numeric characters except +
        import re
        cleaned = re.sub(r'[^\d+]', '', phone_number)

        # Remove leading zeros after country code
        if cleaned.startswith('0') and len(cleaned) > 10:
            cleaned = cleaned[1:]

        # Add country code if missing
        if not cleaned.startswith('+'):
            if cleaned.startswith(country_code.replace('+', '')):
                cleaned = '+' + cleaned
            else:
                cleaned = country_code + cleaned

        return cleaned


# Initialize SMS service
sms_service = SMSService()
