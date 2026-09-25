from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    print("ALL INTEGER COLUMNS:")
    res = conn.execute(text("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE data_type = 'integer'"))
    for row in res.fetchall():
        print(row)
