import requests
import json

def test_interaction():
    url = "http://localhost:8000/api/v1/interactions/"
    # We need a valid token to test this, but let's see if we can at least verify the payload validation logic
    # Or just run a local DB check
    print("Testing interaction creation via backend logic check...")
    
    # Since I don't have a live token easily accessible in CLI without login, 
    # I'll check the DB directly after a manual click if possible, 
    # but I can also just run a script that uses the CRUD logic.
    
    from app.db.session import engine
    from app.models.interaction import Interaction, InteractionType
    from sqlmodel import Session
    import datetime

    with Session(engine) as session:
        print("Creating mock interaction in DB...")
        try:
            # Simulate what the endpoint does after receiving uppercase 'CALL' from Pydantic
            # InteractionType('CALL') -> <InteractionType.CALL: 'call'>
            # Test using the updated lowercase enum member
            interaction_type = InteractionType.call 
            print(f"Enum member: {interaction_type.name}, Value: {interaction_type.value}")
            
            new_interaction = Interaction(
                listing_id=1, 
                buyer_id=1,   
                type=interaction_type.value
            )
            session.add(new_interaction)
            session.commit()
            print("Successfully inserted interaction with .value")
        except Exception as e:
            print(f"Insert failed: {e}")

if __name__ == "__main__":
    test_interaction()
