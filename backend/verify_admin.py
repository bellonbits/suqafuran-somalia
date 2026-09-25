import sys
import os
from sqlalchemy import create_engine, text

# Add the current directory (backend) to sys.path
sys.path.append(os.getcwd())

from app.core.config import settings

def verify_admin():
    print("Starting verification...")
    try:
        db_url = str(settings.DATABASE_URL)
        engine = create_engine(db_url)
        phone_input = "+254 706 070 747"
        phone = phone_input.replace(" ", "")
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id, full_name, is_admin, verified_level FROM \"user\" WHERE phone = :phone"), {"phone": phone})
            user = result.first()
            
            if user:
                print(f"User Found: {user[1]}")
                print(f"Is Admin: {user[2]}")
                print(f"Verified Level: {user[3]}")
            else:
                print("User NOT found.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_admin()
