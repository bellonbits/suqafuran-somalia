from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    print("ALL TABLES:")
    res = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
    for row in res.fetchall():
        print(row)
