"""
One-off script: export every real user email address (excludes the
sms_*@suqafuran.local placeholder addresses generated for phone-only
signups) to a plain text file, comma-separated.

Run: .venv/bin/python export_user_emails.py
Output: user_emails.txt (in the current directory)
"""
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    rows = conn.execute(
        text("""
            SELECT email FROM "user"
            WHERE email IS NOT NULL AND email NOT LIKE '%@suqafuran.local'
            ORDER BY id
        """)
    ).all()

emails = [r[0] for r in rows]
with open("user_emails.txt", "w") as f:
    f.write(",".join(emails))

print(f"Wrote {len(emails)} email(s) to user_emails.txt")
