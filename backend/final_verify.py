import requests

def main():
    try:
        # Assuming the backend is running on localhost:8000
        # If it's in docker, it might be different, but during 'npm run dev' 
        # usually the frontend connects to a local backend.
        # But wait, the logs showed api_1, so it's likely docker.
        # I'll try to fetch listings from the local development server if possible.
        # Actually, I'll just check if the model fetching works internally.
        
        from sqlmodel import Session, select
        from app.db.session import engine
        from app.models.listing import Listing
        
        with Session(engine) as session:
            statement = select(Listing).limit(1)
            results = session.exec(statement).all()
            print(f"Successfully fetched {len(results)} listings.")
            if results:
                listing = results[0]
                print(f"Listing ID: {listing.id}")
                print(f"Views: {listing.views}")
                print(f"Leads: {listing.leads}")
                
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    main()
