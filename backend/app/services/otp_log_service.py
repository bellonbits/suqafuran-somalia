"""
OTP Log Service — centralised, append-only logging for every OTP event.

Usage (fire-and-forget, safe to call anywhere):
    from app.services.otp_log_service import otp_log
    otp_log.record("sent", identifier=phone, channel="sms", expires_in=300)
    otp_log.record("verified", identifier=phone, channel="sms")
    otp_log.record("failed", identifier=phone, channel="sms", meta={"reason": "send_error"})
"""
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session

from app.db.session import engine
from app.models.otp_log import OTPLog

log = logging.getLogger(__name__)

VALID_EVENTS = {"sent", "resent", "verified", "failed", "expired", "attempt_failed"}
VALID_CHANNELS = {"sms", "email", "whatsapp"}


class OTPLogService:
    def record(
        self,
        event_type: str,
        *,
        identifier: str,
        channel: str,
        status: Optional[str] = None,
        attempt_count: int = 0,
        expires_in: Optional[int] = None,        # seconds from now
        meta: Optional[dict] = None,
        idempotency_key: Optional[str] = None,
    ) -> None:
        """
        Persist a single OTP event. Safe to call from anywhere; swallows all
        exceptions so it never disrupts the OTP flow itself.
        """
        try:
            if event_type not in VALID_EVENTS:
                log.warning("[OTPLog] Unknown event_type=%s — skipping", event_type)
                return

            # Default status mapping
            if status is None:
                status = "success" if event_type in ("sent", "resent", "verified") else "failed"

            expires_at = (
                datetime.utcnow() + timedelta(seconds=expires_in)
                if expires_in
                else None
            )

            # Build idempotency key so retries / duplicate calls don't double-log
            if idempotency_key is None:
                raw = f"{identifier}:{event_type}:{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
                idempotency_key = hashlib.sha256(raw.encode()).hexdigest()[:32]

            entry = OTPLog(
                identifier=identifier,
                channel=channel,
                event_type=event_type,
                status=status,
                idempotency_key=idempotency_key,
                attempt_count=attempt_count,
                expires_at=expires_at,
                meta=meta,
            )

            with Session(engine) as session:
                # Skip if we already have this idempotency key (race condition guard)
                from sqlmodel import select
                existing = session.exec(
                    select(OTPLog).where(OTPLog.idempotency_key == idempotency_key)
                ).first()
                if existing:
                    return
                session.add(entry)
                session.commit()

        except Exception as exc:
            # Never propagate — logging must never break OTP flows
            log.exception("[OTPLog] Failed to persist event %s for %s: %s", event_type, identifier, exc)


# Module-level singleton
otp_log = OTPLogService()
