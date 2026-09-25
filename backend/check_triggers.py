from sqlalchemy import text
from app.db.session import engine

def check_triggers():
    with engine.connect() as conn:
        print("TRIGGERS ON USER TABLE:")
        res = conn.execute(text("""
            SELECT tgname, tgfoid::regproc
            FROM pg_trigger 
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
            WHERE pg_class.relname = 'user'
        """))
        for row in res.fetchall():
            print(row)
            
        print("\nALL FUNCTIONS IN PUBLIC SCHEMA:")
        res = conn.execute(text("""
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public'
        """))
        for row in res.fetchall():
            print(row)

if __name__ == "__main__":
    check_triggers()
