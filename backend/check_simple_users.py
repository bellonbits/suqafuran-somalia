import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from app.db.session import engine
from app.models.user import User

def check():
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == "admin@suqafuran.com")).first()
        if user:
            print(f"USER_FOUND: ID={user.id} | Email={user.email} | Phone={user.phone}")
        else:
            print("USER_NOT_FOUND")

if __name__ == "__main__":
    check()
