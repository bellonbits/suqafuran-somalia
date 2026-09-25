from sqlalchemy import text
from app.db.session import engine

def deep_audit():
    with engine.connect() as conn:
        print("COLUMNS IN 'user' TABLE:")
        res = conn.execute(text("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'user' AND table_schema = 'public'"))
        for row in res.fetchall():
            print(f"| {row[0]} | {row[1]} | {row[2]}")

if __name__ == "__main__":
    deep_audit()
