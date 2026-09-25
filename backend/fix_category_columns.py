import os
from sqlalchemy import create_engine, text

DB_URL = os.environ["DATABASE_URL"]  # never hardcode credentials

def migrate():
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        # Add image_url to category table
        try:
            conn.execute(text("ALTER TABLE category ADD COLUMN image_url VARCHAR"))
            conn.commit()
            print("Added image_url column to category table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("image_url column already exists.")
            else:
                print(f"Error adding image_url: {e}")

        # Ensure icon_name exists (it should, but just in case)
        try:
            conn.execute(text("ALTER TABLE category ADD COLUMN icon_name VARCHAR"))
            conn.commit()
            print("Added icon_name column to category table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("icon_name column already exists.")
            else:
                print(f"Error adding icon_name: {e}")

        conn.commit()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
