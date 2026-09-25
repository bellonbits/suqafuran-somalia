from sqlalchemy import text
from app.db.session import engine

def fix_schema():
    with engine.connect() as conn:
        try:
            print("Fixing verified_level default...")
            # Remove the incorrect sequence default
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN verified_level DROP DEFAULT"))
            # Set the correct enum default
            conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN verified_level SET DEFAULT 'guest'"))
            conn.commit()
            print("Successfully fixed verified_level default!")
            
            print("\nRe-checking defaults:")
            res = conn.execute(text("SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'user'"))
            for row in res.fetchall():
                print(row)
        except Exception as e:
            print(f"Failed to fix schema: {e}")

if __name__ == "__main__":
    fix_schema()
