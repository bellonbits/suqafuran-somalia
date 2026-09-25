from sqlalchemy import text
from app.db.session import engine

def final_fix():
    with engine.connect() as conn:
        try:
            print("Running FINAL EXHAUSTIVE schema fix...")
            
            # User table
            print("Fixing 'user' table...")
            cols_to_fix_user = [
                ('is_active', 'true'),
                ('is_verified', 'false'),
                ('is_admin', 'false'),
                ('email_notifications', 'true'),
                ('sms_notifications', 'false'),
                ('verified_level', "'guest'::userverifiedlevel"),
                ('created_at', 'NOW()'),
                ('updated_at', 'NOW()')
            ]
            for col, default in cols_to_fix_user:
                conn.execute(text(f'ALTER TABLE "user" ALTER COLUMN "{col}" DROP DEFAULT'))
                conn.execute(text(f'ALTER TABLE "user" ALTER COLUMN "{col}" SET DEFAULT {default}'))
            
            # Listing table
            print("Fixing 'listing' table...")
            cols_to_fix_listing = [
                ('status', "'pending'"),
                ('boost_level', '0'),
                ('created_at', 'NOW()'),
                ('updated_at', 'NOW()')
            ]
            for col, default in cols_to_fix_listing:
                conn.execute(text(f'ALTER TABLE "listing" ALTER COLUMN "{col}" DROP DEFAULT'))
                conn.execute(text(f'ALTER TABLE "listing" ALTER COLUMN "{col}" SET DEFAULT {default}'))
            
            # Category table
            print("Fixing 'category' table...")
            conn.execute(text('ALTER TABLE "category" ALTER COLUMN "icon_name" DROP DEFAULT'))
            conn.execute(text('ALTER TABLE "category" ALTER COLUMN "attributes_schema" DROP DEFAULT'))
            conn.execute(text('ALTER TABLE "category" ALTER COLUMN "attributes_schema" SET DEFAULT \'{}\''))

            conn.commit()
            print("Successfully applied ALL fixes!")
            
        except Exception as e:
            print(f"FAILED to fix schema: {e}")

if __name__ == "__main__":
    final_fix()
