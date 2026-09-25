from typing import Optional
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from app.core.config import settings

class TwilioService:
    def __init__(self):
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            self.service_sid = settings.TWILIO_VERIFY_SERVICE_SID
        else:
            self.client = None
            self.service_sid = None

    def send_verification_code(self, phone: str) -> bool:
        """
        Send a verification code to the given phone number using Twilio Verify.
        """
        if not self.client or not self.service_sid:
            print(f"Twilio not configured. Simulated SMS to {phone}. Use code: 000000")
            return True
            
        try:
            # Twilio expect phone in E.164 format. 
            # If the phone doesn't start with +, we might need to handle it or assume input is correct.
            formatted_phone = phone if phone.startswith("+") else f"+{phone}"
            
            self.client.verify.v2.services(self.service_sid) \
                .verifications \
                .create(to=formatted_phone, channel='sms')
            return True
        except TwilioRestException as e:
            print(f"Twilio error: {e}")
            return False

    def check_verification_code(self, phone: str, code: str) -> bool:
        """
        Check if the provided code is valid for the phone number.
        """
        if not self.client or not self.service_sid:
            print(f"Twilio not configured. Simulated verification for {phone} with code {code}")
            # For testing without Twilio, we could accept a "000000" code
            return code == "000000"
            
        try:
            formatted_phone = phone if phone.startswith("+") else f"+{phone}"
            
            verification_check = self.client.verify.v2.services(self.service_sid) \
                .verification_checks \
                .create(to=formatted_phone, code=code)
            
            return verification_check.status == "approved"
        except TwilioRestException as e:
            print(f"Twilio check error: {e}")
            return False

twilio_service = TwilioService()
