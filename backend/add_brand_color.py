import os
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

def add_brand_color_column():
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    with Session(engine) as session:
        # Check if column exists
        result = session.exec("SELECT column_name FROM information_schema.columns WHERE table_name='business' AND column_name='brand_color';").first()
        if not result:
            session.exec("ALTER TABLE business ADD COLUMN brand_color VARCHAR DEFAULT '#2563eb';")
            session.commit()
            print('brand_color column added')
        else:
            print('brand_color column already exists')

if __name__ == '__main__':
    add_brand_color_column()
