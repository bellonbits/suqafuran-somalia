from sqlmodel import Session, select
from app.db.session import engine
from app.models import User
from app.core.security import get_password_hash

def test_seed():
    with Session(engine) as session:
        phone = "123"
        statement = select(User).where(User.phone == phone)
        existing = session.exec(statement).first()
        if not existing:
            u = User(
                full_name="Small Phone User",
                phone=phone,
                email="small@example.com",
                hashed_password=get_password_hash("password")
            )
            print("Adding user with phone 123...")
            session.add(u)
            print("Committing...")
            session.commit()
            print("Successfully seeded small phone user!")
        else:
            print("Small phone user already exists.")

if __name__ == "__main__":
    test_seed()
