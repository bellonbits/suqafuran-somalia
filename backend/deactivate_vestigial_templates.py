"""
One-off script: deactivate the 3 EmailTemplate rows for the vestigial
payment/order-confirmation emails removed from email_service.py (Suqafuran
doesn't process payments or deliveries -- these were never wired to a live
checkout flow). Deactivates rather than deletes, preserving EmailLog history.

Run once: .venv/bin/python deactivate_vestigial_templates.py
"""
from sqlalchemy import create_engine, text
from app.core.config import settings

EVENT_TYPES = ["transaction_payment", "transaction_receipt", "transaction_order_confirmation"]

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    result = conn.execute(
        text("UPDATE email_template SET is_active = false, updated_at = now() WHERE event_type = ANY(:types)"),
        {"types": EVENT_TYPES},
    )
    print(f"Deactivated {result.rowcount} template row(s) for: {', '.join(EVENT_TYPES)}")
