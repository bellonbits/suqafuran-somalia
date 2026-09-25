import sys
from sqlmodel import Session, create_engine, select
from app.core.config import settings
from app.models.verification import VerificationRequest

def parse_tuple_string(val: str | None) -> str | None:
    if not val:
        return None
    val_str = str(val).strip()
    if val_str.startswith("(") and val_str.endswith(")"):
        # Strip parentheses
        inner = val_str[1:-1]
        # Split by the first comma (in case the URL itself contains a comma, though highly unlikely)
        parts = inner.split(",", 1)
        if parts:
            url = parts[0].strip().strip("'").strip('"')
            return url
    return val

def clean_verification_requests(dry_run: bool = True):
    engine = create_engine(str(settings.DATABASE_URL))
    with Session(engine) as session:
        requests = session.exec(select(VerificationRequest)).all()
        print(f"Loaded {len(requests)} verification requests. Dry run = {dry_run}\n")
        
        updated_count = 0
        for r in requests:
            changed = False
            
            # 1. Clean document_urls (nested lists of [url, phash])
            new_document_urls = []
            doc_changed = False
            if r.document_urls and isinstance(r.document_urls, list):
                for item in r.document_urls:
                    if isinstance(item, (list, tuple)):
                        new_document_urls.append(item[0])
                        doc_changed = True
                    elif isinstance(item, str):
                        # It might be a string representation of a tuple, check that too
                        parsed = parse_tuple_string(item)
                        if parsed != item:
                            new_document_urls.append(parsed)
                            doc_changed = True
                        else:
                            new_document_urls.append(item)
                    else:
                        new_document_urls.append(str(item))
            
            if doc_changed:
                print(f"Request {r.id}: document_urls will change:\n  OLD: {r.document_urls}\n  NEW: {new_document_urls}")
                r.document_urls = new_document_urls
                changed = True
                
            # 2. Clean selfie_url
            if r.selfie_url:
                parsed_selfie = parse_tuple_string(r.selfie_url)
                if parsed_selfie != r.selfie_url:
                    print(f"Request {r.id}: selfie_url will change:\n  OLD: {r.selfie_url}\n  NEW: {parsed_selfie}")
                    r.selfie_url = parsed_selfie
                    changed = True
                    
            # 3. Clean proof_of_address_url
            if r.proof_of_address_url:
                parsed_address = parse_tuple_string(r.proof_of_address_url)
                if parsed_address != r.proof_of_address_url:
                    print(f"Request {r.id}: proof_of_address_url will change:\n  OLD: {r.proof_of_address_url}\n  NEW: {parsed_address}")
                    r.proof_of_address_url = parsed_address
                    changed = True
                    
            # 4. Clean video_selfie_url
            if r.video_selfie_url:
                parsed_video = parse_tuple_string(r.video_selfie_url)
                if parsed_video != r.video_selfie_url:
                    print(f"Request {r.id}: video_selfie_url will change:\n  OLD: {r.video_selfie_url}\n  NEW: {parsed_video}")
                    r.video_selfie_url = parsed_video
                    changed = True
            
            if changed:
                updated_count += 1
                if not dry_run:
                    session.add(r)
        
        if updated_count > 0:
            if not dry_run:
                session.commit()
                print(f"\nSuccessfully updated {updated_count} records in database!")
            else:
                print(f"\nDry run: would have updated {updated_count} records.")
        else:
            print("\nNo malformed records found! Everything is clean.")

if __name__ == "__main__":
    dry = True
    if len(sys.argv) > 1 and sys.argv[1].lower() == "write":
        dry = False
    clean_verification_requests(dry_run=dry)
