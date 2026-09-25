from sqlalchemy import text
from app.db.session import engine

def drop_message():
    with engine.connect() as conn:
        try:
            print("Dropping legacy message table...")
            conn.execute(text("DROP TABLE IF EXISTS message CASCADE"))
            conn.commit()
            print("Table dropped successfully!")
        except Exception as e:
            print(f"Failed to drop table: {e}")

if __name__ == "__main__":
    drop_message()
