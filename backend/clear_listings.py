import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, delete
from app.db.session import engine
from app.models.listing import Listing

def clear_listings():
    try:
        with Session(engine) as session:
            print("Deleting all listings...")
            session.exec(delete(Listing))
            session.commit()
            print("Successfully cleared all listings.")
    except Exception as e:
        print(f"Error clearing listings: {e}")

if __name__ == "__main__":
    clear_listings()
