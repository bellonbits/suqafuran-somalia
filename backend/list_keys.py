import redis
import os

host = "redis"
port = 6379
password = os.getenv("REDIS_PASSWORD", "suqaredis")
db = 0

print(f"Connecting inside container to Redis at {host}:{port} db={db} with password...")
try:
    r = redis.Redis(host=host, port=port, password=password, db=db, decode_responses=True)
    keys = r.keys("*")
    print(f"Found {len(keys)} keys in container Redis:")
    for key in keys:
        try:
            val = r.get(key)
            print(f"  {key} -> {val}")
        except Exception as e:
            print(f"  {key} (error: {e})")
except Exception as e:
    print(f"Error: {e}")
