from app.db.session import engine
from sqlalchemy import text

def run_migration():
    print("Starting database migration...")
    with engine.connect() as conn:
        # Add brand_color column
        conn.execute(text("ALTER TABLE business ADD COLUMN IF NOT EXISTS brand_color VARCHAR DEFAULT '#2563eb'"))
        # Add tagline column
        conn.execute(text("ALTER TABLE business ADD COLUMN IF NOT EXISTS tagline VARCHAR"))
        conn.commit()
    print("Database migration completed successfully!")

if __name__ == "__main__":
    run_migration()
