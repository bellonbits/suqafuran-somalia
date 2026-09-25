import os
import sqlalchemy
from sqlalchemy import create_engine, text

DB_URL = os.environ["DATABASE_URL"]  # never hardcode credentials

def migrate_categories():
    print(f"Connecting to database...")
    engine = create_engine(DB_URL)
    
    with engine.connect() as conn:
        print("Adding image_url column to category table...")
        try:
            conn.execute(text("ALTER TABLE category ADD COLUMN image_url VARCHAR;"))
            conn.commit()
            print("Successfully added image_url column.")
        except Exception as e:
            if "already exists" in str(e):
                print("image_url column already exists.")
            else:
                print(f"Error adding image_url column: {e}")

        print("Creating subcategory table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subcategory (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    slug VARCHAR NOT NULL,
                    image_url VARCHAR,
                    category_id INTEGER NOT NULL REFERENCES category(id) ON DELETE CASCADE,
                    attributes_schema JSONB DEFAULT '{}'::jsonb
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_subcategory_name ON subcategory (name);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_subcategory_slug ON subcategory (slug);"))
            conn.commit()
            print("Successfully created subcategory table.")
        except Exception as e:
            print(f"Error creating subcategory table: {e}")

if __name__ == "__main__":
    migrate_categories()
