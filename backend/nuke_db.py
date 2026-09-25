from sqlalchemy import text
from app.db.session import engine

def nuke():
    with engine.connect() as conn:
        try:
            print("NUKING USERS AND LISTINGS...")
            conn.execute(text("TRUNCATE TABLE listing CASCADE"))
            conn.execute(text("TRUNCATE TABLE \"user\" CASCADE"))
            conn.execute(text("TRUNCATE TABLE category CASCADE"))
            conn.commit()
            print("Successfully nuked!")
        except Exception as e:
            print(f"FAILED to nuke: {e}")

if __name__ == "__main__":
    nuke()
