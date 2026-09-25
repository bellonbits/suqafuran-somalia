from sqlmodel import create_engine, Session, select
import redis
import sys
import os

# Try to load from .env if possible
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def test_db():
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    server = os.getenv("POSTGRES_SERVER", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "suqafuran_db")
    
    url = f"postgresql://{user}:{password}@{server}:{port}/{db_name}"
    print(f"Testing DB connection to: {url}")
    
    try:
        engine = create_engine(url)
        with Session(engine) as session:
            session.execute(select(1))
        print("✅ Database connection successful!")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_redis():
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    print(f"Testing Redis connection to: {url}")
    
    try:
        r = redis.from_url(url)
        r.ping()
        print("✅ Redis connection successful!")
        return True
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return False

if __name__ == "__main__":
    db_ok = test_db()
    redis_ok = test_redis()
    
    if db_ok and redis_ok:
        print("\n🎉 All services are accessible!")
        sys.exit(0)
    else:
        print("\n⚠️ Some services failed to connect. Check your .env and service status.")
        sys.exit(1)
