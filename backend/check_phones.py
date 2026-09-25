from sqlmodel import Session, create_session, create_engine, select
from app.models.user import User
from app.core.config import settings

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
with Session(engine) as session:
    users = session.exec(select(User).where(User.phone == None)).all()
    print(f"Users with NULL phone: {len(users)}")
    for u in users:
        print(f"ID: {u.id}, Email: {u.email}")
