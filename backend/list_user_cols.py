from sqlalchemy import text
from app.db.session import engine

def list_cols():
    with engine.connect() as conn:
        print("COLUMNS IN 'user' TABLE:")
        res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user'"))
        for row in res.fetchall():
            print(f"{row[0]}: {row[1]}")

if __name__ == "__main__":
    list_cols()
