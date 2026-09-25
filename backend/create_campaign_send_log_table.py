"""
One-off script: create campaign_send_log directly via SQL, since this repo's
alembic history has had divergent-head issues in the past that make
`alembic upgrade head` unreliable. A proper migration also exists
(alembic/versions/campaign_send_log_001.py) for anyone running a clean chain.

Run once: .venv/bin/python create_campaign_send_log_table.py
"""
from sqlalchemy import create_engine, text
from app.core.config import settings

DDL = """
CREATE TABLE IF NOT EXISTS campaign_send_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    campaign_type VARCHAR NOT NULL,
    subject_variant VARCHAR NOT NULL,
    category_id INTEGER REFERENCES category(id),
    listing_ids VARCHAR,
    shop_ids VARCHAR,
    template_event_type VARCHAR,
    email_log_id INTEGER REFERENCES emaillog(id),
    sent_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_campaign_send_log_user_id ON campaign_send_log (user_id);
CREATE INDEX IF NOT EXISTS ix_campaign_send_log_campaign_type ON campaign_send_log (campaign_type);
CREATE INDEX IF NOT EXISTS ix_campaign_send_log_category_id ON campaign_send_log (category_id);
CREATE INDEX IF NOT EXISTS ix_campaign_send_log_sent_at ON campaign_send_log (sent_at);
CREATE INDEX IF NOT EXISTS ix_campaign_send_log_user_type_sent ON campaign_send_log (user_id, campaign_type, sent_at);
"""

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    conn.execute(text(DDL))
print("campaign_send_log table ready")
