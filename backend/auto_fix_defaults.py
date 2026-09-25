from sqlalchemy import text
from app.db.session import engine

def auto_fix_defaults():
    with engine.connect() as conn:
        print("Finding all columns with unauthorized nextval defaults...")
        res = conn.execute(text("""
            SELECT table_name, column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE column_default LIKE '%nextval%' 
            AND column_name NOT IN ('id', 'pos')
            AND table_schema = 'public'
        """))
        bad_cols = res.fetchall()
        
        if not bad_cols:
            print("No bad defaults found!")
            return

        print(f"Found {len(bad_cols)} bad columns. Fixing...")
        
        for table, col, dtype, default in bad_cols:
            print(f"Fixing {table}.{col} (dtype: {dtype})...")
            
            # Remove bad default
            conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" DROP DEFAULT'))
            
            # Set appropriate new default
            if dtype == 'boolean':
                # Default to false for booleans, except a few
                if col in ('is_active', 'email_notifications'):
                    new_val = 'true'
                else:
                    new_val = 'false'
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT {new_val}'))
            elif dtype == 'integer' or dtype == 'smallint':
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT 0'))
            elif 'timestamp' in dtype:
                conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT NOW()'))
            elif 'character' in dtype or dtype == 'text':
                if col == 'status':
                    conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT \'pending\''))
                elif col == 'verified_level':
                    conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT \'guest\'::userverifiedlevel'))
                else:
                    conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT \'\''))
            
            conn.commit()
            print(f"Fixed {table}.{col}")

if __name__ == "__main__":
    auto_fix_defaults()
