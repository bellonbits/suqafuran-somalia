import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Category

def check_categories():
    try:
        with Session(engine) as session:
            categories = session.exec(select(Category)).all()
            print(f"Total Categories found: {len(categories)}")
            for cat in categories:
                subcats = cat.attributes_schema.get('subcategories', []) if cat.attributes_schema else []
                print(f"ID: {cat.id} | Name: {cat.name} | Slug: {cat.slug} | Subcats: {len(subcats)}")
    except Exception as e:
        print(f"Error checking categories: {e}")

if __name__ == "__main__":
    check_categories()
