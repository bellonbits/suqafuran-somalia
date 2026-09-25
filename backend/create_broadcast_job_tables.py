"""
One-off script: create broadcast_job and broadcast_job_recipient directly via
SQL, since this repo's alembic history has had divergent-head issues in the
past that make `alembic upgrade head` unreliable. A proper migration also
exists (alembic/versions/broadcast_job_001.py) for a clean chain.

Run once: .venv/bin/python create_broadcast_job_tables.py
"""
from sqlalchemy import create_engine, text
from app.core.config import settings

DDL = """
CREATE TABLE IF NOT EXISTS broadcast_job (
    id SERIAL PRIMARY KEY,
    subject VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    subtitle VARCHAR,
    content_html VARCHAR NOT NULL,
    action_text VARCHAR,
    action_url VARCHAR,
    campaign_id VARCHAR,
    daily_limit INTEGER NOT NULL DEFAULT 250,
    status VARCHAR NOT NULL DEFAULT 'in_progress',
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES "user"(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_broadcast_job_status ON broadcast_job (status);

CREATE TABLE IF NOT EXISTS broadcast_job_recipient (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES broadcast_job(id),
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    email VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    failed_reason VARCHAR
);
CREATE INDEX IF NOT EXISTS ix_broadcast_job_recipient_job_id ON broadcast_job_recipient (job_id);
CREATE INDEX IF NOT EXISTS ix_broadcast_job_recipient_user_id ON broadcast_job_recipient (user_id);
CREATE INDEX IF NOT EXISTS ix_broadcast_job_recipient_status ON broadcast_job_recipient (status);
CREATE INDEX IF NOT EXISTS ix_broadcast_job_recipient_sent_at ON broadcast_job_recipient (sent_at);
"""

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    conn.execute(text(DDL))
print("broadcast_job / broadcast_job_recipient tables ready")
