from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    print("CATEGORIES IN DATABASE:")
    res = conn.execute(text("SELECT id, slug, name FROM category"))
    for row in res.fetchall():
        print(row)
