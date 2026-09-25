import africastalking
import secrets
import redis
from typing import Optional
from app.core.config import settings


MAX_OTP_ATTEMPTS = 5

class AfricasTalkingService:
    def __init__(self):
        self.username = settings.AFRICASTALKING_USERNAME
        self.api_key = settings.AFRICASTALKING_API_KEY
        self.sender_id = settings.AFRICASTALKING_SENDER_ID
        self.environment = settings.ENVIRONMENT
        
        print(f"[AT Init] Username: {self.username}")
        print(f"[AT Init] API Key present: {bool(self.api_key)}")
        print(f"[AT Init] API Key length: {len(self.api_key) if self.api_key else 0}")
        print(f"[AT Init] Sender ID: {self.sender_id}")
        print(f"[AT Init] Environment: {self.environment}")
        
        if self.username and self.api_key:
            try:
                africastalking.initialize(self.username, self.api_key)
                self.sms = africastalking.SMS
                print(f"[AT Init] Successfully initialized with username: {self.username}")
            except Exception as e:
                print(f"[AT Init] Initialization error: {e}")
                self.sms = None
        else:
            print("[AT Init] Missing credentials, SMS disabled")
            self.sms = None
            
        # Initialize Redis for OTP storage
        try:
            from app.utils.redis import from_url_safe
            self.redis = from_url_safe(settings.REDIS_URL, decode_responses=True)
            print("[AT Init] Redis connected successfully")
        except Exception as e:
            print(f"[AT Init] Redis connection error: {e}")
            self.redis = None

    def normalize_phone(self, phone: str) -> str:
        """Normalize to E.164. Supports Somalia (+252) and Kenya (+254)."""
        phone = phone.strip().replace(" ", "").replace("-", "")

        # Already E.164
        if phone.startswith("+"):
            return phone

        # Country code without +
        if phone.startswith("252") and len(phone) >= 12:
            return "+" + phone
        if phone.startswith("254") and len(phone) >= 12:
            return "+" + phone

        # Somali local: 06x / 07x / 09x
        if phone.startswith("0") and len(phone) == 9:
            return "+252" + phone[1:]

        # Kenyan local: 07x / 01x (10 digits)
        if phone.startswith("0") and len(phone) == 10:
            return "+254" + phone[1:]

        raise ValueError(f"Invalid phone number format: {phone}")

    def generate_otp(self) -> str:
        """
        Generate a cryptographically secure 6-digit OTP.
        Uses secrets module instead of random for security.
        """
        return str(secrets.randbelow(900000) + 100000)

    def check_rate_limit(self, phone: str) -> bool:
        """
        Check if phone number has exceeded OTP request rate limit.
        Allows 3 requests per 5 minutes.
        """
        if not self.redis:
            return True  # Allow if Redis is down
            
        key = f"otp_attempts:{phone}"
        attempts = self.redis.get(key)
        
        if attempts and int(attempts) >= 3:
            print(f"[AT] Rate limit exceeded for {phone}")
            return False
        
        return True

    def increment_rate_limit(self, phone: str):
        """
        Increment rate limit counter for phone number.
        """
        if not self.redis:
            return
            
        key = f"otp_attempts:{phone}"
        self.redis.incr(key)
        self.redis.expire(key, 300)  # 5 minutes

    def send_verification_code(self, phone: str, is_resend: bool = False) -> bool:
        """
        Generate, store and send a verification code via Premium SMS.
        """
        from app.services.otp_log_service import otp_log

        try:
            # Normalize phone number
            normalized_phone = self.normalize_phone(phone)
        except ValueError as e:
            print(f"[AT] Phone normalization error: {e}")
            otp_log.record("failed", identifier=phone, channel="sms",
                           meta={"reason": f"phone_normalization_error: {e}"})
            return False

        # Check rate limit
        if not self.check_rate_limit(normalized_phone):
            otp_log.record("failed", identifier=normalized_phone, channel="sms",
                           meta={"reason": "rate_limit_exceeded"})
            return False

        # Generate secure OTP
        code = self.generate_otp()

        # Store in Redis with 5 minute expiry
        if self.redis:
            self.redis.set(f"otp:{normalized_phone}", code, ex=300)
            print(f"[AT] Stored OTP for {normalized_phone}")
        else:
            print(f"[AT] CRITICAL: Redis not available")
            if self.environment == "production":
                otp_log.record("failed", identifier=normalized_phone, channel="sms",
                               meta={"reason": "redis_unavailable"})
                return False
            code = "000000"

        # Increment rate limit
        self.increment_rate_limit(normalized_phone)

        # Development mode: skip SMS
        if not self.sms:
            print(f"[AT] Development mode. Phone: {normalized_phone}, Code: {code}")
            event = "resent" if is_resend else "sent"
            otp_log.record(event, identifier=normalized_phone, channel="sms",
                           expires_in=300, meta={"mode": "development"})
            return True

        try:
            message = f"Your Suqafuran verification code is: {code}"

            print(f"[AT] Sending Premium SMS to {normalized_phone}")

            if self.username == "sandbox":
                response = self.sms.send(message, [normalized_phone])
            else:
                response = self.sms.send(
                    message,
                    [normalized_phone],
                    sender_id=self.sender_id
                )

            print(f"[AT] SMS Response: {response}")

            if response and 'SMSMessageData' in response:
                recipients = response['SMSMessageData'].get('Recipients', [])
                if recipients:
                    status_code = recipients[0].get('statusCode', 0)
                    if status_code in [100, 101, 102]:
                        print(f"[AT] SMS sent successfully. Status: {status_code}")
                        event = "resent" if is_resend else "sent"
                        otp_log.record(event, identifier=normalized_phone, channel="sms",
                                       expires_in=300,
                                       meta={"provider_status": status_code})
                        return True
                    else:
                        print(f"[AT] SMS failed. Status code: {status_code}")
                        otp_log.record("failed", identifier=normalized_phone, channel="sms",
                                       meta={"provider_status": status_code})
                        if self.environment == "production":
                            return False

            event = "resent" if is_resend else "sent"
            otp_log.record(event, identifier=normalized_phone, channel="sms",
                           expires_in=300, meta={"provider_response": str(response)[:200]})
            return True

        except Exception as e:
            print(f"\n[AT] SMS SENDING FAILED: {e}")
            otp_log.record("failed", identifier=normalized_phone, channel="sms",
                           meta={"reason": str(e)[:300]})

            if self.environment == "production":
                return False

            print("\n" + "="*40)
            print(f"  DEVELOPMENT OTP FALLBACK")
            print(f"  Phone: {normalized_phone}")
            print(f"  Code:  {code}")
            print("="*40 + "\n")
            event = "resent" if is_resend else "sent"
            otp_log.record(event, identifier=normalized_phone, channel="sms",
                           expires_in=300, meta={"mode": "development_fallback"})
            return True

    def check_verification_code(self, phone: str, code: str) -> bool:
        """
        Check if the provided code matches the one in Redis.
        """
        from app.services.otp_log_service import otp_log

        try:
            normalized_phone = self.normalize_phone(phone)
        except ValueError as e:
            print(f"[AT] Phone normalization error: {e}")
            otp_log.record("attempt_failed", identifier=phone, channel="sms",
                           meta={"reason": f"phone_normalization_error: {e}"})
            return False

        if not self.redis:
            if self.environment == "development":
                if code == "000000":
                    otp_log.record("verified", identifier=normalized_phone, channel="sms",
                                   meta={"mode": "development"})
                    return True
                otp_log.record("attempt_failed", identifier=normalized_phone, channel="sms",
                               meta={"mode": "development"})
                return False
            return False

        stored_code = self.redis.get(f"otp:{normalized_phone}")

        # Track attempt count via a separate Redis counter
        attempt_key = f"otp_verify_attempts:{normalized_phone}"
        attempt_count = int(self.redis.incr(attempt_key))
        self.redis.expire(attempt_key, 600)

        # A 6-digit code can be brute-forced if guesses are unlimited: after
        # MAX_OTP_ATTEMPTS wrong tries the code is burned and a new one is needed.
        if attempt_count > MAX_OTP_ATTEMPTS:
            self.redis.delete(f"otp:{normalized_phone}")
            otp_log.record("attempt_failed", identifier=normalized_phone, channel="sms",
                           status="failed", attempt_count=attempt_count,
                           meta={"reason": "too_many_attempts"})
            return False

        if stored_code and stored_code == code:
            self.redis.delete(f"otp:{normalized_phone}")
            self.redis.delete(attempt_key)
            print(f"[AT] OTP verified for {normalized_phone}")
            otp_log.record("verified", identifier=normalized_phone, channel="sms",
                           attempt_count=attempt_count)
            return True

        # Wrong code
        print(f"[AT] OTP verification failed for {normalized_phone}")
        otp_log.record(
            "expired" if not stored_code else "attempt_failed",
            identifier=normalized_phone,
            channel="sms",
            status="failed",
            attempt_count=attempt_count,
        )
        return False

    def store_pending_signup(self, phone: str, signup_data: dict) -> bool:
        """
        Store pending signup data in Redis with 10-minute expiry.
        """
        try:
            normalized_phone = self.normalize_phone(phone)
        except ValueError as e:
            print(f"[AT] Phone normalization error: {e}")
            return False
            
        if not self.redis:
            print(f"[AT] Redis not available, cannot store pending signup")
            return False
            
        try:
            import json
            self.redis.set(f"signup:{normalized_phone}", json.dumps(signup_data), ex=600)
            print(f"[AT] Stored pending signup for {normalized_phone}")
            return True
        except Exception as e:
            print(f"[AT] Error storing pending signup: {e}")
            return False

    def get_pending_signup(self, phone: str) -> dict | None:
        """
        Retrieve pending signup data from Redis.
        """
        try:
            normalized_phone = self.normalize_phone(phone)
        except ValueError:
            return None
            
        if not self.redis:
            return None
            
        try:
            import json
            data = self.redis.get(f"signup:{normalized_phone}")
            if data:
                print(f"[AT] Retrieved pending signup for {normalized_phone}")
                return json.loads(data)
            return None
        except Exception as e:
            print(f"[AT] Error retrieving pending signup: {e}")
            return None

    def delete_pending_signup(self, phone: str) -> bool:
        """
        Delete pending signup data from Redis.
        """
        try:
            normalized_phone = self.normalize_phone(phone)
        except ValueError:
            return False
            
        if not self.redis:
            return False
            
        try:
            self.redis.delete(f"signup:{normalized_phone}")
            print(f"[AT] Deleted pending signup for {normalized_phone}")
            return True
        except Exception as e:
            print(f"[AT] Error deleting pending signup: {e}")
            return False

africastalking_service = AfricasTalkingService()
