from sqlalchemy import text
from app.db.session import engine

def deep_audit():
    with engine.connect() as conn:
        print("DEEP AUDIT OF 'user' TABLE COLUMNS (PUBLIC SCHEMA):")
        res = conn.execute(text("""
            SELECT 
                column_name, 
                data_type, 
                column_default, 
                is_nullable, 
                character_maximum_length, 
                numeric_precision, 
                numeric_precision_radix, 
                numeric_scale,
                datetime_precision
            FROM information_schema.columns 
            WHERE table_name = 'user' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        """))
        for row in res.fetchall():
            print(f"-- COLUMN: {row[0]} --")
            print(f"Type: {row[1]}")
            print(f"Default: {row[2]}")
            print(f"Nullable: {row[3]}")
            print(f"Max Len: {row[4]}")
            print(f"Num Prec: {row[5]}")
            print(f"Num Radix: {row[6]}")
            print(f"Num Scale: {row[7]}")
            print(f"TS Prec: {row[8]}")
            print("-" * 20)

if __name__ == "__main__":
    deep_audit()
