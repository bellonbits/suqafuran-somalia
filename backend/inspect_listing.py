import os
from sqlalchemy import create_engine, text

DB_URL = os.environ["DATABASE_URL"]  # never hardcode credentials

def inspect():
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'listing'"))
        columns = [row[0] for row in result]
        print(f"Columns in listing table: {columns}")

if __name__ == "__main__":
    inspect()
