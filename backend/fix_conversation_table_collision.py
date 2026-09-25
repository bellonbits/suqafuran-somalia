#!/usr/bin/env python3
"""
Corrective migration -- `conversation` was already a live (if empty) table
name used by an unrelated, pre-existing feature (Suqafuran-as-system
messaging to users, see app/models/conversation.py and
app/services/system_messaging_service.py). create_conversation_table.py
dropped it and created a same-named table for the new buyer/seller
marketplace-chat feature instead, which would have broken that other
feature on next deploy.

This script:
  1. Renames the table just created (buyer_id/listing_id/status schema,
     with the 37 already-backfilled conversations) to
     `marketplace_conversation`. Postgres tracks foreign keys by internal
     id, not name, so message.conversation_id keeps pointing at the right
     rows automatically -- no data is touched.
  2. Recreates empty `conversation` and `conversation_message` tables
     matching their original schema, restoring the pre-existing feature.

Usage:
    python fix_conversation_table_collision.py
"""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def main():
    db = SessionLocal()
    try:
        db.execute(text("SET statement_timeout = '20s'"))

        cols = db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation'"
        )).fetchall()
        col_names = {c[0] for c in cols}

        if "buyer_id" in col_names:
            count = db.execute(text("SELECT COUNT(*) FROM conversation")).scalar()
            db.execute(text("ALTER TABLE conversation RENAME TO marketplace_conversation"))
            db.commit()
            print(f"Renamed `conversation` ({count} rows) -> `marketplace_conversation`.")
        elif "buyer_id" in {c[0] for c in db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'marketplace_conversation'"
        )).fetchall()}:
            print("`marketplace_conversation` already exists -- rename already done.")
        else:
            print("ABORTING: couldn't find the new-schema table under either expected name. Inspect manually.")
            return

        conv_exists = db.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'conversation'"
        )).scalar()
        if not conv_exists:
            db.execute(text("""
                CREATE TABLE conversation (
                    id SERIAL PRIMARY KEY,
                    seller_id INTEGER NOT NULL REFERENCES "user"(id),
                    customer_id INTEGER NOT NULL REFERENCES "user"(id),
                    last_message VARCHAR,
                    unread_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_seller_id ON conversation(seller_id)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_customer_id ON conversation(customer_id)"))
            db.commit()
            print("Recreated original, empty `conversation` table.")
        else:
            print("`conversation` table already present -- skipping recreate.")

        conv_msg_exists = db.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'conversation_message'"
        )).scalar()
        if not conv_msg_exists:
            db.execute(text("""
                CREATE TABLE conversation_message (
                    id SERIAL PRIMARY KEY,
                    conversation_id INTEGER NOT NULL REFERENCES conversation(id),
                    sender_id INTEGER NOT NULL REFERENCES "user"(id),
                    content VARCHAR NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_message_conversation_id ON conversation_message(conversation_id)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_message_sender_id ON conversation_message(sender_id)"))
            db.commit()
            print("Recreated original, empty `conversation_message` table.")
        else:
            print("`conversation_message` table already present -- skipping recreate.")

        mc_count = db.execute(text("SELECT COUNT(*) FROM marketplace_conversation")).scalar()
        msg_linked = db.execute(text("SELECT COUNT(*) FROM message WHERE conversation_id IS NOT NULL")).scalar()
        print(f"Verification: marketplace_conversation has {mc_count} rows; {msg_linked} messages are linked to one.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
