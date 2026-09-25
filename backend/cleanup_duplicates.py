from sqlmodel import Session, create_engine, select, func
from app.models.user import User
from app.core.config import settings

from sqlalchemy import text
engine = create_engine(str(settings.DATABASE_URL))
with Session(engine) as session:
    # Find duplicate phones using raw SQL to avoid schema issues with User model
    res = session.execute(text("SELECT phone, COUNT(id) FROM \"user\" GROUP BY phone HAVING COUNT(id) > 1"))
    duplicates = res.all()
    
    print(f"Found {len(duplicates)} duplicate/null phone groups.")
    for phone, count in duplicates:
        print(f"Group: {phone}, Count: {count}")
        if phone is None:
            res_users = session.execute(text("SELECT id FROM \"user\" WHERE phone IS NULL ORDER BY id"))
        else:
            res_users = session.execute(text("SELECT id FROM \"user\" WHERE phone = :phone ORDER BY id"), {"phone": phone})
        
        user_ids = [r[0] for r in res_users.all()]
        keep_id = user_ids[0]
        delete_ids = user_ids[1:]
        
        print(f"  Keeping ID: {keep_id}")
        for d_id in delete_ids:
            print(f"  Reassigning dependencies for ID: {d_id} to ID: {keep_id}")
            # Get keep_user's wallet_id
            res_k_wallet = session.execute(text("SELECT id FROM wallet WHERE user_id = :id"), {"id": keep_id}).first()
            k_wallet_id = res_k_wallet[0] if res_k_wallet else None
            
            # Get delete_user's wallet_id
            res_d_wallet = session.execute(text("SELECT id FROM wallet WHERE user_id = :id"), {"id": d_id}).first()
            d_wallet_id = res_d_wallet[0] if res_d_wallet else None

            # Reassign listings and other direct refs
            session.execute(text("UPDATE listing SET owner_id = :k WHERE owner_id = :d"), {"k": keep_id, "d": d_id})
            session.execute(text("UPDATE favorite SET user_id = :k WHERE user_id = :d"), {"k": keep_id, "d": d_id})
            session.execute(text("UPDATE notification SET user_id = :k WHERE user_id = :d"), {"k": keep_id, "d": d_id})
            session.execute(text("UPDATE verificationrequest SET user_id = :k WHERE user_id = :d"), {"k": keep_id, "d": d_id})
            session.execute(text("UPDATE message SET sender_id = :k WHERE sender_id = :d"), {"k": keep_id, "d": d_id})
            session.execute(text("UPDATE message SET receiver_id = :k WHERE receiver_id = :d"), {"k": keep_id, "d": d_id})
            
            # Merge Wallets
            if d_wallet_id:
                if k_wallet_id:
                    # Move transactions to keep_wallet
                    session.execute(text("UPDATE \"transaction\" SET wallet_id = :k WHERE wallet_id = :d"), {"k": k_wallet_id, "d": d_wallet_id})
                    # Delete old wallet
                    session.execute(text("DELETE FROM wallet WHERE id = :id"), {"id": d_wallet_id})
                else:
                    # Just reassign the wallet to the keep_user
                    session.execute(text("UPDATE wallet SET user_id = :k WHERE user_id = :d"), {"k": keep_id, "d": d_id})
            
            print(f"  Deleting ID: {d_id}")
            session.execute(text("DELETE FROM \"user\" WHERE id = :id"), {"id": d_id})
    
    session.commit()
    print("Cleanup complete.")
