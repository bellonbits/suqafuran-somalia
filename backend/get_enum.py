from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    print("ENUM VALUES FOR 'userverifiedlevel':")
    res = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'userverifiedlevel'"))
    for row in res.fetchall():
        print(row)
