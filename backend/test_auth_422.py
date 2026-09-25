import requests
import json

base_url = "http://localhost:8888/api/v1"

def test_verify_otp():
    payload = {
        "phone": "+254793046776",
        "otp": "123456"
    }
    print(f"Testing with payload: {payload}")
    response = requests.post(f"{base_url}/auth/verify-otp", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    if 'set-cookie' in response.headers:
        print("Success: Set-Cookie header found!")
    else:
        print("Warning: Set-Cookie header NOT found.")
    
    try:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        if 'access_token' in data:
            print("Success: 'access_token' key found!")
        else:
            print("Warning: 'access_token' key NOT found.")
    except:
        print(f"Text: {response.text}")

if __name__ == "__main__":
    test_verify_otp()
