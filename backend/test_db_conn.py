import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def test_conn():
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_SERVER"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            database="defaultdb", # Strip suffix for raw psycopg2 test
            port=os.getenv("POSTGRES_PORT"),
            sslmode="require"
        )
        print("Successfully connected to PostgreSQL!")
        conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_conn()
