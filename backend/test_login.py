import requests

def test_login():
    url = "http://localhost:8888/api/v1/login/access-token"
    # Testing with +252610000001 which is in the DB
    payload = {
        "username": "+252610000001",
        "password": "changeme" # Default if not changed
    }
    
    response = requests.post(url, data=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_login()
