from sqlalchemy import text
from app.db.session import engine

def test_sql():
    with engine.connect() as conn:
        try:
            print("Attempting SQL insert WITHOUT verified_level...")
            conn.execute(text("INSERT INTO \"user\" (phone, full_name, email, is_active, is_verified, is_admin) VALUES ('test-sql-3', 'Test SQL', 'testsql3@example.com', true, false, false)"))
            conn.commit()
            print("SQL Insert Success!")
        except Exception as e:
            print(f"SQL Insert Failed: {e}")

if __name__ == "__main__":
    test_sql()
