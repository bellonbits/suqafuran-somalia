from sqlmodel import Session, create_engine, select
from app.models.user import User
from app.core.config import settings
from app.core.security import get_password_hash

engine = create_engine(settings.DATABASE_URL)

def reset_admin_password():
    with Session(engine) as session:
        statement = select(User).where(User.phone == "+252610000001")
        user = session.exec(statement).first()
        if user:
            user.hashed_password = get_password_hash("changeme")
            user.phone_verified = True
            user.is_verified = True
            session.add(user)
            session.commit()
            print(f"Successfully reset password and verified admin {user.phone}")
        else:
            print("Admin user not found")

if __name__ == "__main__":
    reset_admin_password()
