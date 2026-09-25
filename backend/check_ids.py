from sqlalchemy import text
from app.db.session import engine

with engine.connect() as conn:
    res = conn.execute(text("SELECT MAX(id) FROM \"user\""))
    print(f"MAX ID in user table: {res.fetchone()[0]}")
    
    try:
        res = conn.execute(text("SELECT last_value FROM user_id_seq"))
        print(f"Sequence last_value: {res.fetchone()[0]}")
    except Exception as e:
        print(f"Could not check sequence: {e}")
