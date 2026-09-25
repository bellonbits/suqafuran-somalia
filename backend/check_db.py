from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    print("USER TABLE COLUMNS AND TYPES:")
    res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user'"))
    for row in res.fetchall():
        print(row)
