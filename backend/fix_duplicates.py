
import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Category

def fix():
    with Session(engine) as session:
        # specific fix for household-items
        cat = session.exec(select(Category).where(Category.slug == "household-items")).first()
        if cat:
            print(f"Deleting duplicate category: {cat.name} (slug: {cat.slug})")
            session.delete(cat)
            session.commit()
            print("Deleted.")
        else:
            print("No duplicate found for household-items")

if __name__ == "__main__":
    fix()
