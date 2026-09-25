from sqlmodel import Session, select
from app.db.session import engine
from app.models.user import User, UserVerifiedLevel
from app.core.security import get_password_hash
import os
from dotenv import load_dotenv

load_dotenv()

def create_admin():
    admin_email = "admin@suqafuran.com"
    admin_password = "adminpassword123" # Change this on first login
    admin_phone = "+252610000000"

    with Session(engine) as session:
        # Check if user already exists
        statement = select(User).where(User.email == admin_email)
        existing_user = session.exec(statement).first()

        if existing_user:
            print(f"Admin user {admin_email} already exists. Updating password and permissions...")
            existing_user.is_admin = True
            existing_user.is_verified = True
            existing_user.email_verified = True
            existing_user.verified_level = UserVerifiedLevel.trusted
            existing_user.hashed_password = get_password_hash(admin_password)
            session.add(existing_user)
            session.commit()
            print(f"Admin password reset to: {admin_password}")
            return

        # Create new admin
        new_admin = User(
            full_name="System Admin",
            email=admin_email,
            phone=admin_phone,
            is_active=True,
            is_verified=True,
            email_verified=True,
            phone_verified=True,
            is_admin=True,
            verified_level=UserVerifiedLevel.trusted,
            hashed_password=get_password_hash(admin_password)
        )
        
        session.add(new_admin)
        session.commit()
        print(f"Admin user {admin_email} created successfully!")
        print(f"Login with email: {admin_email} and password: {admin_password}")

if __name__ == "__main__":
    create_admin()
