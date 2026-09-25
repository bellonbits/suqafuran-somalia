import os
from sqlalchemy import text
from app.db.session import engine

def check_db():
    print(f"DATABASE_URL: {os.getenv('DATABASE_URL')}")
    print(f"POSTGRES_SERVER: {os.getenv('POSTGRES_SERVER')}")
    
    tables = ["category", "listing", "user"]
    with engine.connect() as conn:
        for table in tables:
            try:
                result = conn.execute(text(f'SELECT count(*) FROM "{table}"'))
                count = result.scalar()
                print(f"Table {table} count: {count}")
            except Exception as e:
                print(f"Error checking {table}: {e}")

if __name__ == "__main__":
    check_db()
