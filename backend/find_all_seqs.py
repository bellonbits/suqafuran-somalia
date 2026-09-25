from sqlalchemy import text
from app.db.session import engine

def find_all_sequences():
    with engine.connect() as conn:
        print("UNFILTERED SEQUENCE DEFAULTS (TABLE, COLUMN, DEFAULT):")
        res = conn.execute(text("""
            SELECT table_name, column_name, column_default 
            FROM information_schema.columns 
            WHERE column_default LIKE '%nextval%' 
            AND table_schema = 'public'
        """))
        for row in res.fetchall():
            print(row)

if __name__ == "__main__":
    find_all_sequences()
