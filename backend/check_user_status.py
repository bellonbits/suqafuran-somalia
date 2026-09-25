from sqlmodel import Session, create_engine, select
from app.models.user import User
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

def check_users():
    with Session(engine) as session:
        statement = select(User)
        users = session.exec(statement).all()
        print("\nUSER_DATA_START")
        for u in users:
            print(f"ID:{u.id}|Phone:{u.phone}|Admin:{u.is_admin}|Active:{u.is_active}|Verified:{u.phone_verified}")
        print("USER_DATA_END")

if __name__ == "__main__":
    check_users()
