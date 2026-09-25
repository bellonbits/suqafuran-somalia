from sqlalchemy import text
from app.db.session import engine

def find_bad_defaults():
    with engine.connect() as conn:
        print("COLUMNS WITH INCORRECT SEQUENCE DEFAULTS:")
        res = conn.execute(text("""
            SELECT table_name, column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE column_default LIKE '%nextval%' 
            AND column_name != 'id'
            AND table_schema = 'public'
        """))
        found = False
        for row in res.fetchall():
            print(row)
            found = True
        
        if not found:
            print("None found!")

if __name__ == "__main__":
    find_bad_defaults()
