from sqlalchemy import text
from app.db.session import engine

def surgical_check():
    with engine.connect() as conn:
        print("SURGICAL CHECK OF USER TABLE DEFAULTS (INCLUDING TIMESTAMPS):")
        res = conn.execute(text("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'user'"))
        for row in res.fetchall():
            print(row)

if __name__ == "__main__":
    surgical_check()
