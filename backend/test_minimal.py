from sqlalchemy import create_engine
from sqlmodel import Session
from app.core.config import settings
from app.models import User

# Redefine engine with echo
engine = create_engine(str(settings.DATABASE_URL), echo=True)

def test_minimal():
    with Session(engine) as session:
        try:
            u = User(
                phone="minimal-test-echo-2",
            )
            print("Adding minimal user...")
            session.add(u)
            print("Committing...")
            session.commit()
            print("Successfully seeded minimal user!")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    test_minimal()
