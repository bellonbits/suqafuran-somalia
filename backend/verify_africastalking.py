import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.africastalking_service import africastalking_service
import time

def test_africastalking_flow():
    test_phone = "+254700000000"
    
    print(f"--- Testing Send OTP ---")
    success = africastalking_service.send_verification_code(test_phone)
    print(f"Send Success: {success}")
    
    if not success:
        print("Failed to initiate send.")
        return

    # Check Redis storage
    otp_in_redis = africastalking_service.redis.get(f"otp:{test_phone}")
    print(f"OTP stored in Redis: {otp_in_redis}")
    
    if not otp_in_redis:
        print("FAIL: OTP not found in Redis.")
        return

    print(f"\n--- Testing Verify OTP (Correct Code) ---")
    is_valid = africastalking_service.check_verification_code(test_phone, otp_in_redis)
    print(f"Verification Success (Expect True): {is_valid}")

    print(f"\n--- Testing Verify OTP (Wrong Code) ---")
    is_valid = africastalking_service.check_verification_code(test_phone, "000000")
    print(f"Verification Success (Expect False): {is_valid}")

    print(f"\n--- Testing Sandbox Fallback ---")
    is_valid = africastalking_service.check_verification_code("+254711111111", "000000")
    print(f"Sandbox Verification (Expect True): {is_valid}")

if __name__ == "__main__":
    test_africastalking_flow()
