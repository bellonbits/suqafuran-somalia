"""Service for monitoring notification delivery and funnel analytics.

Backed by the two real, populated delivery-log tables that already exist:
  - EmailLog (app/models/email_log.py) -- every email actually sent, with
    status (queued/sent/opened/clicked/bounced/failed) and email_type.
  - OTPLog (app/models/otp_log.py) -- every OTP lifecycle event (sent,
    verified, failed, expired), across sms/email/whatsapp.

There is currently no delivery log for push notifications (User.fcm_token
exists, but nothing records a send attempt against it) -- push numbers are
honestly reported as zero/untracked rather than fabricated.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, cast, Integer
from sqlmodel import Session, select
from app.models.email_log import EmailLog
from app.models.otp_log import OTPLog

logger = logging.getLogger(__name__)

FAILURE_STATUSES = {"failed", "bounced"}


class NotificationMetrics:
    """Calculate notification funnel and delivery metrics from real send logs."""

    def __init__(self, db: Session):
        self.db = db

    def get_channel_stats_24h(self) -> Dict[str, int]:
        """Counts for the simple 3-card summary (email/sms/push, last 24h)."""
        since = datetime.utcnow() - timedelta(hours=24)
        email_count = self.db.exec(
            select(func.count()).select_from(EmailLog).where(EmailLog.sent_at >= since)
        ).one()
        sms_count = self.db.exec(
            select(func.count()).select_from(OTPLog).where(
                OTPLog.created_at >= since, OTPLog.channel == "sms", OTPLog.event_type.in_(["sent", "resent"])
            )
        ).one()
        return {"email_count": email_count, "sms_count": sms_count, "push_count": 0}

    def get_funnel_data(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        domain: Optional[str] = None,
        channel: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> List[Dict]:
        """Funnel per event type/channel: real stage counts, not simulated ones.

        Email funnel: sent -> opened -> clicked (from EmailLog's own status
        transitions). SMS/OTP funnel: sent -> verified (from OTPLog).
        """
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(days=1)
        if date_to is None:
            date_to = datetime.utcnow()

        funnel_data: List[Dict] = []

        if channel is None or channel == "email":
            rows = self.db.exec(
                select(
                    EmailLog.email_type,
                    func.count().label("sent"),
                    func.sum(cast(EmailLog.opened_at.isnot(None), Integer)).label("opened"),
                    func.sum(cast(EmailLog.clicked_at.isnot(None), Integer)).label("clicked"),
                    func.sum(cast(EmailLog.status.in_(FAILURE_STATUSES), Integer)).label("failed"),
                )
                .where(EmailLog.sent_at >= date_from, EmailLog.sent_at <= date_to)
                .group_by(EmailLog.email_type)
            ).all()
            for row in rows:
                et, sent, opened, clicked, failed = row
                if event_type and event_type.lower() not in (et or "").lower():
                    continue
                sent = sent or 0
                opened = opened or 0
                clicked = clicked or 0
                failed = failed or 0
                funnel_data.append({
                    "event_type": et or "unknown",
                    "channel": "email",
                    "stages": [
                        {"name": "Sent", "count": sent},
                        {"name": "Opened", "count": opened},
                        {"name": "Clicked", "count": clicked},
                    ],
                    "success_rate": round((sent - failed) / sent * 100, 1) if sent else 100.0,
                    "total_sent": sent,
                    "total_failed": failed,
                    "avg_delivery_time_ms": None,
                })

        if channel is None or channel == "sms":
            otp_rows = self.db.exec(
                select(
                    OTPLog.event_type,
                    func.count().label("c"),
                )
                .where(
                    OTPLog.created_at >= date_from, OTPLog.created_at <= date_to, OTPLog.channel == "sms"
                )
                .group_by(OTPLog.event_type)
            ).all()
            counts = {et: c for et, c in otp_rows}
            sent = counts.get("sent", 0) + counts.get("resent", 0)
            verified = counts.get("verified", 0)
            failed = counts.get("failed", 0) + counts.get("attempt_failed", 0)
            if sent or verified or failed:
                if not event_type or event_type.lower() in "auth.otp":
                    funnel_data.append({
                        "event_type": "auth.otp",
                        "channel": "sms",
                        "stages": [
                            {"name": "Sent", "count": sent},
                            {"name": "Verified", "count": verified},
                        ],
                        "success_rate": round(verified / sent * 100, 1) if sent else 100.0,
                        "total_sent": sent,
                        "total_failed": failed,
                        "avg_delivery_time_ms": None,
                    })

        return funnel_data

    def get_notification_summary(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        domain: Optional[str] = None,
        channel: Optional[str] = None,
    ) -> List[Dict]:
        """Per-event-type table: sent, failed, success rate -- from real logs."""
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(days=1)
        if date_to is None:
            date_to = datetime.utcnow()

        summary: List[Dict] = []

        if channel is None or channel == "email":
            rows = self.db.exec(
                select(
                    EmailLog.email_type,
                    EmailLog.provider_used,
                    func.count().label("total"),
                    func.sum(cast(EmailLog.status.in_(FAILURE_STATUSES), Integer)).label("failed"),
                )
                .where(EmailLog.sent_at >= date_from, EmailLog.sent_at <= date_to)
                .group_by(EmailLog.email_type, EmailLog.provider_used)
            ).all()
            for et, provider, total, failed in rows:
                total = total or 0
                failed = failed or 0
                sent = total - failed
                summary.append({
                    "event_type": et or "unknown",
                    "channel": "email",
                    "provider": provider or "unknown",
                    "sent": sent,
                    "failed": failed,
                    "pending": 0,
                    "success_rate": round(sent / total * 100, 1) if total else 100.0,
                    "failure_rate": round(failed / total * 100, 1) if total else 0.0,
                    "avg_delivery_time_ms": None,
                    "last_24h_trend": None,
                })

        if channel is None or channel == "sms":
            rows = self.db.exec(
                select(
                    OTPLog.event_type,
                    func.count().label("total"),
                )
                .where(OTPLog.created_at >= date_from, OTPLog.created_at <= date_to, OTPLog.channel == "sms")
                .group_by(OTPLog.event_type)
            ).all()
            counts = {et: c for et, c in rows}
            sent = counts.get("sent", 0) + counts.get("resent", 0)
            failed = counts.get("failed", 0) + counts.get("attempt_failed", 0)
            total = sent + failed
            if total:
                summary.append({
                    "event_type": "auth.otp",
                    "channel": "sms",
                    "provider": "africas_talking",
                    "sent": sent,
                    "failed": failed,
                    "pending": 0,
                    "success_rate": round(sent / total * 100, 1) if total else 100.0,
                    "failure_rate": round(failed / total * 100, 1) if total else 0.0,
                    "avg_delivery_time_ms": None,
                    "last_24h_trend": None,
                })

        return summary

    def get_notification_attempts(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
        channel: Optional[str] = None,
        user_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> Tuple[List[Dict], int]:
        """Individual send attempts, real rows from EmailLog + OTPLog, merged
        and sorted by time. Paginated in Python since it's a union of two
        different tables -- fine at this volume."""
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(days=1)
        if date_to is None:
            date_to = datetime.utcnow()

        attempts: List[Dict] = []

        if channel is None or channel == "email":
            query = select(EmailLog).where(EmailLog.sent_at >= date_from, EmailLog.sent_at <= date_to)
            if user_id:
                query = query.where(EmailLog.user_id == user_id)
            if event_type:
                query = query.where(EmailLog.email_type.ilike(f"%{event_type}%"))
            rows = self.db.exec(query.order_by(EmailLog.sent_at.desc()).limit(500)).all()
            for row in rows:
                row_status = "delivered" if row.status in ("opened", "clicked") else row.status
                attempts.append({
                    "id": f"email_{row.id}",
                    "event_id": str(row.id),
                    "event_type": row.email_type,
                    "channel": "email",
                    "provider": row.provider_used or "unknown",
                    "user_id": row.user_id,
                    "email": row.email,
                    "status": row_status,
                    "error_message": row.failed_reason,
                    "correlation_id": row.campaign_id,
                    "trace_id": None,
                    "dispatched_at": row.sent_at,
                    "delivered_at": row.opened_at or (row.sent_at if row.status == "sent" else None),
                    "delivery_time_ms": None,
                    "title": row.subject,
                })

        if channel is None or channel == "sms":
            query = select(OTPLog).where(
                OTPLog.created_at >= date_from, OTPLog.created_at <= date_to, OTPLog.channel == "sms"
            )
            if event_type:
                query = query.where(OTPLog.event_type.ilike(f"%{event_type}%"))
            rows = self.db.exec(query.order_by(OTPLog.created_at.desc()).limit(500)).all()
            status_map = {"sent": "delivered", "resent": "delivered", "verified": "delivered", "failed": "failed", "attempt_failed": "failed", "expired": "failed"}
            for row in rows:
                attempts.append({
                    "id": f"otp_{row.id}",
                    "event_id": str(row.id),
                    "event_type": f"auth.otp.{row.event_type}",
                    "channel": "sms",
                    "provider": "africas_talking",
                    "user_id": None,
                    "phone_number": row.identifier,
                    "status": status_map.get(row.event_type, row.status),
                    "error_message": (row.meta or {}).get("reason") if row.meta else None,
                    "correlation_id": row.idempotency_key,
                    "trace_id": None,
                    "dispatched_at": row.created_at,
                    "delivered_at": row.created_at if row.status == "success" else None,
                    "delivery_time_ms": None,
                })

        if status:
            attempts = [a for a in attempts if a["status"] == status]

        attempts.sort(key=lambda a: a["dispatched_at"], reverse=True)

        total = len(attempts)
        paginated = attempts[skip: skip + limit]

        return paginated, total

    def retry_notification(self, notification_id: str) -> Dict:
        """Email/OTP sends aren't queued for async retry today -- there's no
        dispatch queue to re-publish to (unlike the Kafka-based
        catalog/payments events this was originally modeled on). Surfacing
        that honestly instead of pretending a retry was queued."""
        logger.info(f"Retry requested for notification: {notification_id}")
        return {
            "status": "unsupported",
            "notification_id": notification_id,
            "message": "Manual retry isn't available for email/SMS sends yet -- resend the underlying action (e.g. resend OTP) instead.",
        }
