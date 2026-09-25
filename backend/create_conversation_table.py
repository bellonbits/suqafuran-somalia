#!/usr/bin/env python3
"""
One-off: create the `conversation` table, add `message.conversation_id`,
and backfill existing messages into conversation rows so the admin
Messages panel has history from day one, not just messages sent after
this deploys.

Never prints message content -- only row/conversation counts.

Usage:
    python create_conversation_table.py
"""
import sys
from collections import defaultdict
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def main():
    db = SessionLocal()
    try:
        # A `conversation` table already exists from an earlier, abandoned
        # attempt at this feature -- wrong columns (seller_id/customer_id/
        # last_message/unread_count, no buyer_id/listing_id/status), zero
        # rows, and not referenced anywhere in the current codebase. A
        # second leftover table, `conversation_message`, has an FK into it
        # (also empty). Both are safe to replace; dropping the child table
        # first avoids needing CASCADE (and its extra locking) entirely.
        existing_count = db.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'conversation'"
        )).scalar()
        if existing_count:
            row_count = db.execute(text("SELECT COUNT(*) FROM conversation")).scalar()
            if row_count != 0:
                print(f"ABORTING: existing `conversation` table has {row_count} rows -- inspect manually before proceeding.")
                return

            child_exists = db.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'conversation_message'"
            )).scalar()
            if child_exists:
                child_count = db.execute(text("SELECT COUNT(*) FROM conversation_message")).scalar()
                if child_count != 0:
                    print(f"ABORTING: `conversation_message` has {child_count} rows -- inspect manually before proceeding.")
                    return
                db.execute(text("SET statement_timeout = '20s'"))
                db.execute(text("DROP TABLE conversation_message"))
                db.commit()
                print("Dropped empty, unused legacy `conversation_message` table.")

            db.execute(text("SET statement_timeout = '20s'"))
            db.execute(text("DROP TABLE conversation"))
            db.commit()
            print("Dropped empty, unused legacy `conversation` table.")

        db.execute(text("""
            CREATE TABLE IF NOT EXISTS conversation (
                id SERIAL PRIMARY KEY,
                buyer_id INTEGER NOT NULL REFERENCES "user"(id),
                seller_id INTEGER NOT NULL REFERENCES "user"(id),
                listing_id INTEGER REFERENCES listing(id),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
                last_message_preview VARCHAR,
                buyer_unread_count INTEGER NOT NULL DEFAULT 0,
                seller_unread_count INTEGER NOT NULL DEFAULT 0,
                message_count INTEGER NOT NULL DEFAULT 0,
                status VARCHAR NOT NULL DEFAULT 'active',
                admin_reviewed BOOLEAN NOT NULL DEFAULT FALSE
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_buyer_id ON conversation(buyer_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_seller_id ON conversation(seller_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_listing_id ON conversation(listing_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_last_message_at ON conversation(last_message_at DESC)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_status ON conversation(status)"))
        db.execute(text('ALTER TABLE message ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversation(id)'))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_message_conversation_id ON message(conversation_id)"))
        db.commit()
        print("Schema ready: conversation table + message.conversation_id")

        already_backfilled = db.execute(text("SELECT COUNT(*) FROM conversation")).scalar()
        if already_backfilled:
            print(f"Skipping backfill -- {already_backfilled} conversation rows already exist.")
            return

        # id/sender/receiver/listing/is_read/created_at only -- len(content) for
        # the preview is computed in SQL via LEFT(), raw text never leaves the DB.
        rows = db.execute(text("""
            SELECT id, sender_id, receiver_id, listing_id, is_read, created_at, LEFT(content, 200) AS preview
            FROM message ORDER BY created_at
        """)).fetchall()

        if not rows:
            print("No existing messages to backfill.")
            return

        listing_owner = dict(db.execute(text("SELECT id, owner_id FROM listing")).fetchall())

        groups = defaultdict(list)
        for row in rows:
            pair = tuple(sorted([row.sender_id, row.receiver_id]))
            groups[(pair, row.listing_id)].append(row)

        created = 0
        for (pair, listing_id), msgs in groups.items():
            owner_id = listing_owner.get(listing_id) if listing_id else None
            if owner_id and owner_id in pair:
                seller_id = owner_id
                buyer_id = pair[0] if pair[1] == owner_id else pair[1]
            else:
                # No listing tie (or owner not resolvable) -- whoever sent
                # the first message in the pair is treated as the buyer.
                buyer_id = msgs[0].sender_id
                seller_id = msgs[0].receiver_id

            last = msgs[-1]
            buyer_unread = sum(1 for m in msgs if m.receiver_id == buyer_id and not m.is_read)
            seller_unread = sum(1 for m in msgs if m.receiver_id == seller_id and not m.is_read)

            conv_id = db.execute(text("""
                INSERT INTO conversation
                    (buyer_id, seller_id, listing_id, created_at, updated_at,
                     last_message_at, last_message_preview, buyer_unread_count,
                     seller_unread_count, message_count)
                VALUES
                    (:buyer_id, :seller_id, :listing_id, :created_at, :updated_at,
                     :last_message_at, :preview, :buyer_unread, :seller_unread, :count)
                RETURNING id
            """), {
                "buyer_id": buyer_id, "seller_id": seller_id, "listing_id": listing_id,
                "created_at": msgs[0].created_at, "updated_at": last.created_at,
                "last_message_at": last.created_at, "preview": last.preview,
                "buyer_unread": buyer_unread, "seller_unread": seller_unread, "count": len(msgs),
            }).scalar()

            message_ids = [m.id for m in msgs]
            db.execute(
                text("UPDATE message SET conversation_id = :cid WHERE id = ANY(:ids)"),
                {"cid": conv_id, "ids": message_ids},
            )
            created += 1

        db.commit()
        print(f"Backfilled {created} conversations from {len(rows)} existing messages.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
