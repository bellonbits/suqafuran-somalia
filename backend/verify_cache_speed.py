import requests
import time

URL = "https://api.suqafuran.com/api/v1/listings/categories"
# Note: I'll use localhost for testing the local backend changes
LOCAL_URL = "http://localhost:8000/api/v1/listings/categories"

def test_speed():
    # First request (cold)
    start = time.time()
    try:
        r1 = requests.get(LOCAL_URL)
        t1 = time.time() - start
        print(f"First request (cold): {t1:.4f}s")
        
        # Second request (hot)
        start = time.time()
        r2 = requests.get(LOCAL_URL)
        t2 = time.time() - start
        print(f"Second request (hot cache): {t2:.4f}s")
        
        if t2 < t1:
            print("SUCCESS: Cache is working!")
        else:
            print("WARNING: Cache did not significantly improve speed (maybe data is small or network noise)")
            
    except Exception as e:
        print(f"Could not connect to {LOCAL_URL}: {e}")

if __name__ == "__main__":
    test_speed()
