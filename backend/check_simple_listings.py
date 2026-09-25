import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Listing

def check():
    with Session(engine) as session:
        listings = session.exec(select(Listing)).all()
        print(f"COUNT={len(listings)}")
        for l in listings:
            print(f"ID={l.id} | Title={l.title} | Price={l.price}")

if __name__ == "__main__":
    check()
