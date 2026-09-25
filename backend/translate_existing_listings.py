from sqlmodel import Session, select
from deep_translator import GoogleTranslator
from app.db.session import engine
from app.models.listing import Listing
import time

def translate_listings():
    print("Fetching listings that need translation...")
    
    # 1. Fetch only the data we need, then CLOSE the connection
    needs_translation = []
    with Session(engine) as session:
        all_count = len(session.exec(select(Listing)).all())
        print(f"Total listings in DB: {all_count}")
        listings = session.exec(select(Listing).where(Listing.title_so.is_(None))).all()
        for l in listings:
            needs_translation.append({
                "id": l.id,
                "title": l.title,
                "description": l.description
            })
            
    total = len(needs_translation)
    print(f"Found {total} listings to translate. Translating in memory...")
    
    if total == 0:
        return
        
    translator = GoogleTranslator(source="en", target="so")
    translated_data = []
    
    count = 0
    # 2. Iterate and translate WITHOUT holding a db connection open
    for item in needs_translation:
        print(f"Translating: {item['title']}")
        try:
            t_title = translator.translate(item['title']) if item['title'] else None
            
            t_desc = None
            if item['description']:
                desc = item['description']
                if len(desc) > 4900:
                    desc = desc[:4900]
                t_desc = translator.translate(desc)
                
            translated_data.append({
                "id": item["id"],
                "title_so": t_title,
                "description_so": t_desc
            })
            count += 1
            time.sleep(0.2)
        except Exception as e:
            print(f"Error translating item {item['id']}: {e}")
            time.sleep(2)
            
    print(f"Finished translation mapping string generation! Saving to DB...")

    # 3. Open a new connection ONLY to save the results back
    with Session(engine) as session:
        for t_item in translated_data:
            listing = session.get(Listing, t_item["id"])
            if listing:
                listing.title_so = t_item["title_so"]
                listing.description_so = t_item["description_so"]
                session.add(listing)
        session.commit()
        
    print(f"Successfully saved {count}/{total} translated listings to the database.")

if __name__ == "__main__":
    translate_listings()
