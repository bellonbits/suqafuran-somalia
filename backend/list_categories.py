import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select
from app.db.session import engine, init_db
from app.models.listing import Category

def list_cats():
    with Session(engine) as session:
        cats = session.exec(select(Category)).all()
        for c in cats:
            print(f"ID: {c.id} | Slug: {c.slug} | Name: {c.name_en}")

if __name__ == "__main__":
    list_cats()
