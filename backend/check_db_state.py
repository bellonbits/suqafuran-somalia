import sys
from sqlalchemy import create_engine, text, inspect
from app.core.config import settings

def check_state():
    print("Checking database state...")
    try:
        # Create engine directly to avoid dependency issues
        engine = create_engine(settings.DATABASE_URL)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"Tables found: {tables}")
        
        if 'alembic_version' in tables:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT * FROM alembic_version"))
                versions = result.fetchall()
                print(f"Alembic Version(s): {versions}")
        else:
            print("alembic_version table NOT found!")
    except Exception as e:
        print(f"Error checking state: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_state()
