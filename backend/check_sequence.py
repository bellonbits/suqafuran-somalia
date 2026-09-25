from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    print("USER_ID_SEQ METADATA:")
    res = conn.execute(text("SELECT * FROM pg_sequences WHERE sequencename = 'user_id_seq'"))
    row = res.fetchone()
    if row:
        keys = list(res.keys())
        for i, val in enumerate(row):
            print(f"{keys[i]}: {val}")
    else:
        print("Sequence not found!")
