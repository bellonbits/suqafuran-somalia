from sqlalchemy import text
from app.db.session import engine

def main():
    print("Migrating Database: adding analytics columns...")
    with engine.connect() as conn:
        try:
            # Add columns to listing table
            print("Adding 'views' to listing...")
            conn.execute(text("ALTER TABLE listing ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0"))
            
            print("Adding 'leads' to listing...")
            conn.execute(text("ALTER TABLE listing ADD COLUMN IF NOT EXISTS leads INTEGER DEFAULT 0"))
            
            # Add column to user table
            print("Adding 'profile_views' to user...")
            conn.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0"))
            
            conn.commit()
            print("Successfully added analytics columns.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    main()
