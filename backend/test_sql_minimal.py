from sqlalchemy import text
from app.db.session import engine

def run_test():
    with engine.connect() as conn:
        try:
            print("Attempting SQL insert with essential fields...")
            # We add fields one by one to see when it fails with out of range
            conn.execute(text("""
                INSERT INTO "user" (
                    phone, full_name, email, 
                    is_active, is_verified, is_admin,
                    verified_level, response_time,
                    email_notifications, sms_notifications,
                    created_at, updated_at
                ) VALUES (
                    '+252610000009', 'Test Somali', 'somali9@example.com',
                    true, false, false,
                    'guest', 'test',
                    true, false,
                    NOW(), NOW()
                )
            """))
            conn.commit()
            print("Success!")
        except Exception as e:
            print(f"FAILED: {e}")
            if hasattr(e, 'orig') and hasattr(e.orig, 'diag'):
                diag = e.orig.diag
                print(f"Primary: {diag.message_primary}")
                print(f"Detail: {diag.message_detail}")
                print(f"Column: {diag.column_name}")
                print(f"Table: {diag.table_name}")

if __name__ == "__main__":
    run_test()
