import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Category

def check():
    with Session(engine) as session:
        count = session.exec(select(Category)).all()
        print(f"COUNT={len(count)}")
        for c in count:
            sc = c.attributes_schema.get('subcategories', []) if c.attributes_schema else []
            print(f"CAT={c.id}|{c.slug}|{len(sc)}")

if __name__ == "__main__":
    check()
