import sys
import os
from datetime import datetime
from sqlalchemy import create_engine, text

# Add the current directory (backend) to sys.path
sys.path.append(os.getcwd())

from app.core.config import settings
from app.core.security import get_password_hash

def create_admin_raw():
    try:
        # Construct DB URL if needed, similar to fix_db.py
        db_url = str(settings.DATABASE_URL)
        print(f"Connecting to DB: {db_url}")
        engine = create_engine(db_url)

        phone_input = "+254 706 070 747"
        phone = phone_input.replace(" ", "")
        print(f"Target Phone: {phone}")

        with engine.connect() as conn:
            # Check if user exists
            # Note: "user" table might need quoting in some contexts, but let's try standard
            result = conn.execute(text("SELECT id, full_name, is_admin, is_verified, verified_level FROM \"user\" WHERE phone = :phone"), {"phone": phone})
            user = result.first()

            if user:
                print(f"User found: {user[1]} (ID: {user[0]})")
                # Update
                # Only update if needed? Let's just update to be sure.
                print("Promoting to Admin and Trusted...")
                conn.execute(text("""
                    UPDATE "user" 
                    SET is_admin = true, is_verified = true, verified_level = 'trusted', updated_at = :now
                    WHERE id = :user_id
                """), {"now": datetime.utcnow(), "user_id": user[0]})
                conn.commit()
                print("User updated successfully.")
            else:
                print("User not found. Creating new Admin user...")
                password = "AdminPassword@123"
                hashed_pw = get_password_hash(password)
                now = datetime.utcnow()
                
                # Insert
                conn.execute(text("""
                    INSERT INTO "user" (phone, full_name, hashed_password, is_active, is_verified, is_admin, verified_level, created_at, updated_at, email_notifications, sms_notifications)
                    VALUES (:phone, 'Super Admin', :hashed_pw, true, true, true, 'trusted', :now, :now, true, false)
                """), {
                    "phone": phone,
                    "hashed_pw": hashed_pw,
                    "now": now
                })
                conn.commit()
                print(f"Admin user created successfully.")
                print(f"Phone: {phone}")
                print(f"Password: {password}")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_admin_raw()
