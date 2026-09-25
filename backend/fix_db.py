import sys
import os
import psycopg2

# Try to get backend folder in path
current = os.path.dirname(os.path.realpath(__file__))
parent = os.path.dirname(current)
sys.path.append(current)

from app.core.config import settings

def main():
    print(f"Connecting to DB...")
    try:
        url = str(settings.DATABASE_URL)
        conn = psycopg2.connect(url)
        cursor = conn.cursor()
        print("Executing ALTER TABLE...")
        cursor.execute("ALTER TABLE mobiletransaction ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'USD'")
        conn.commit()
        print("Success! Added 'currency' column.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    main()
