from sqlalchemy import text
from app.db.session import engine

def check_enum():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'interactiontype'"))
        labels = [row[0] for row in result.fetchall()]
        print(f"Enum 'interactiontype' labels: {labels}")

if __name__ == "__main__":
    check_enum()
