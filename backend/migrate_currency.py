import sys
import os
from sqlalchemy import text

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine

def migrate():
    try:
        with engine.connect() as conn:
            print("Checking if 'currency' column exists in 'listing' table...")
            # Use text() to run raw SQL
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='listing' AND column_name='currency'"))
            column_exists = result.fetchone() is not None
            
            if not column_exists:
                print("Adding 'currency' column to 'listing' table...")
                conn.execute(text("ALTER TABLE listing ADD COLUMN currency VARCHAR DEFAULT 'USD'"))
                conn.commit()
                print("Column 'currency' added successfully.")
            else:
                print("Column 'currency' already exists.")
    except Exception as e:
        print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
