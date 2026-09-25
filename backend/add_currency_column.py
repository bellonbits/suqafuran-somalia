from sqlalchemy import text
from app.db.session import engine

def main():
    print("Migrating Database: adding 'currency' column to mobiletransaction...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE mobiletransaction ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'USD'"))
            conn.commit()
            print("Successfully added 'currency' column.")
        except Exception as e:
            print(f"Migration failed (maybe column exists?): {e}")

if __name__ == "__main__":
    main()
