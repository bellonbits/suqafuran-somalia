import os
import sys
from sqlmodel import Session, select, delete

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine
from app.models.business import (
    Business, Employee, BusinessProduct, BusinessCustomer, Order,
    BusinessMessage, TeamMessage, BusinessTask
)

def delete_all_businesses():
    print("======================================================================")
    print("🧹 NUking ALL EXISTING BUSINESSES/SHOPS TO PREPARE FOR NEW SHops")
    print("======================================================================\n")

    with Session(engine) as session:
        # Get all businesses
        businesses = session.exec(select(Business)).all()
        print(f"ℹ️ Found {len(businesses)} existing business records in database.")

        if not businesses:
            print("✅ Database is already clear of businesses. Nothing to delete!")
            return

        print("Deleting associated records to prevent foreign key violations...")
        
        # Delete dependent children
        session.exec(delete(BusinessTask))
        session.exec(delete(TeamMessage))
        session.exec(delete(BusinessMessage))
        session.exec(delete(Order))
        session.exec(delete(BusinessCustomer))
        session.exec(delete(BusinessProduct))
        session.exec(delete(Employee))
        
        # Delete businesses
        for b in businesses:
            print(f"🗑️ Deleting Business: {b.name} (Slug: {b.slug}, ID: {b.id})")
            session.delete(b)
            
        session.commit()
        print("\n✅ All old shops and associated employee/product/order/task/message records successfully deleted!")

if __name__ == "__main__":
    delete_all_businesses()
