import traceback
import sys
from sqlmodel import Session
from app.db.session import engine
from app.models import User
from app.core.security import get_password_hash

def run_test():
    with Session(engine) as session:
        try:
            u = User(
                full_name="String Tester",
                phone="+252610000011",
                email="string@example.com",
                hashed_password=get_password_hash("password"),
                verified_level="guest" # type: ignore
            )
            print("Adding user...")
            session.add(u)
            print("Committing...")
            session.commit()
            print("Success (unexpected)")
        except Exception as e:
            print("--- CAUGHT EXCEPTION ---")
            print(f"Type: {type(e)}")
            print(f"Message: {str(e)}")
            print("--- FULL TRACEBACK ---")
            traceback.print_exc()
            
            # Try to get sqlalchemy original error
            orig = getattr(e, 'orig', None)
            if orig:
                print("--- ORIGINAL EXCEPTION ---")
                print(f"Orig type: {type(orig)}")
                print(f"Orig content: {orig}")
                
                # psycopg2 diagnostics
                diag = getattr(orig, 'diag', None)
                if diag:
                    print("--- DIAGNOSTICS ---")
                    # Diag attributes are properties in psycopg2.extensions.Diagnostics
                    attrs = [
                        'severity', 'message_primary', 'message_detail', 
                        'message_hint', 'column_name', 'constraint_name', 
                        'table_name', 'type_name'
                    ]
                    for attr in attrs:
                        try:
                            val = getattr(diag, attr)
                            print(f"{attr}: {val}")
                        except AttributeError:
                            pass

if __name__ == "__main__":
    run_test()
