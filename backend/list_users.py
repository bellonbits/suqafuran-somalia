from sqlmodel import Session, select
from app.db.session import engine
from app.models.user import User

def list_users():
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        for u in users:
            print(f"EMAIL: {u.email}")

if __name__ == "__main__":
    list_users()
