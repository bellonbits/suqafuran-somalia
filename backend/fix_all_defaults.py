from sqlalchemy import text
from app.db.session import engine

def fix_all_defaults():
    with engine.connect() as conn:
        try:
            print("Fixing user table defaults...")
            
            # User table fixes
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN is_active SET DEFAULT true"))
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN is_verified SET DEFAULT false"))
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN is_admin SET DEFAULT false"))
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN email_notifications SET DEFAULT true"))
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN sms_notifications SET DEFAULT false"))
            
            # Listing table fixes (found status had it too)
            print("Fixing listing table defaults...")
            conn.execute(text("ALTER TABLE \"listing\" ALTER COLUMN status SET DEFAULT 'pending'"))
            conn.execute(text("ALTER TABLE \"listing\" ALTER COLUMN boost_level SET DEFAULT 0"))
            
            conn.commit()
            print("Successfully fixed all detected incorrect defaults!")
            
            print("\nVerifying 'user' defaults:")
            res = conn.execute(text("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'user'"))
            for row in res.fetchall():
                if row[2] and 'nextval' in row[2] and row[0] != 'id':
                    print(f"!!! STILL WRONG: {row[0]} -> {row[2]}")
                else:
                    print(f"{row[0]}: {row[2]}")
                    
        except Exception as e:
            print(f"Failed to fix schema: {e}")

if __name__ == "__main__":
    fix_all_defaults()
