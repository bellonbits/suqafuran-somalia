"""
One-off migration: add lipana_tx_id column to the promotion table.
Run this once: python migrate_lipana.py
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

db_url = (
    f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_SERVER')}:{os.getenv('POSTGRES_PORT', '5432')}"
    f"/{os.getenv('POSTGRES_DB')}"
)

engine = create_engine(db_url)

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE promotion
        ADD COLUMN IF NOT EXISTS lipana_tx_id VARCHAR
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_promotion_lipana_tx_id
        ON promotion (lipana_tx_id)
    """))
    conn.commit()
    print("✅ lipana_tx_id column added to promotion table.")
