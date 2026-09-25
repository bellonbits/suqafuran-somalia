import sys
import os
from sqlalchemy import text

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine

def migrate():
    try:
        with engine.connect() as conn:
            print("Running migrations for business table...")
            
            # Determine database type
            is_postgres = "postgresql" in str(engine.url)
            
            # 1. Add show_in_nearby
            show_in_nearby_exists = False
            if is_postgres:
                result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='business' AND column_name='show_in_nearby'"))
                show_in_nearby_exists = result.fetchone() is not None
            else:
                result = conn.execute(text("PRAGMA table_info(business)"))
                columns = [row[1] for row in result.fetchall()]
                show_in_nearby_exists = 'show_in_nearby' in columns
                
            if not show_in_nearby_exists:
                print("Adding 'show_in_nearby' column to 'business' table...")
                if is_postgres:
                    conn.execute(text("ALTER TABLE business ADD COLUMN show_in_nearby BOOLEAN DEFAULT FALSE"))
                else:
                    conn.execute(text("ALTER TABLE business ADD COLUMN show_in_nearby BOOLEAN DEFAULT 0"))
                conn.commit()
                print("Column 'show_in_nearby' added successfully.")
            else:
                print("Column 'show_in_nearby' already exists.")
                
            # 2. Add is_approved
            is_approved_exists = False
            if is_postgres:
                result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='business' AND column_name='is_approved'"))
                is_approved_exists = result.fetchone() is not None
            else:
                result = conn.execute(text("PRAGMA table_info(business)"))
                columns = [row[1] for row in result.fetchall()]
                is_approved_exists = 'is_approved' in columns
                
            if not is_approved_exists:
                print("Adding 'is_approved' column to 'business' table...")
                if is_postgres:
                    conn.execute(text("ALTER TABLE business ADD COLUMN is_approved BOOLEAN DEFAULT FALSE"))
                else:
                    conn.execute(text("ALTER TABLE business ADD COLUMN is_approved BOOLEAN DEFAULT 0"))
                conn.commit()
                print("Column 'is_approved' added successfully.")
            else:
                print("Column 'is_approved' already exists.")
                
    except Exception as e:
        print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
