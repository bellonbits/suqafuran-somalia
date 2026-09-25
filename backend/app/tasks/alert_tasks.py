"""Celery tasks for alert rule evaluation."""

import logging
from celery import shared_task
from app.db.session import SessionLocal
from app.services.alert_engine import get_alert_engine

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="evaluate_alert_rules")
def evaluate_alert_rules(self):
    """Periodically evaluate all active alert rules.

    Scheduled to run every 5 minutes via Celery Beat.
    """
    db = SessionLocal()
    try:
        engine = get_alert_engine(db)

        # Evaluate all rules
        import asyncio
        results = asyncio.run(engine.evaluate_all_rules())

        # Log results
        triggered_count = sum(1 for r in results if r.triggered)
        logger.info(
            f"Alert evaluation completed: {len(results)} rules evaluated, "
            f"{triggered_count} triggered"
        )

        return {
            "total_rules": len(results),
            "triggered_alerts": triggered_count,
            "status": "success",
        }
    except Exception as e:
        logger.error(f"Error in alert evaluation task: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
        }
    finally:
        db.close()


@shared_task(bind=True, name="cleanup_old_alerts")
def cleanup_old_alerts(self, days: int = 30):
    """Remove alert history older than specified days.

    Scheduled to run daily via Celery Beat.
    """
    db = SessionLocal()
    try:
        from datetime import datetime, timedelta
        from sqlmodel import delete
        from app.models.monitoring import AlertHistory

        cutoff_date = datetime.utcnow() - timedelta(days=days)
        statement = delete(AlertHistory).where(AlertHistory.created_at < cutoff_date)

        result = db.exec(statement)
        db.commit()

        logger.info(f"Cleaned up {result} old alert records older than {days} days")

        return {
            "status": "success",
            "records_deleted": result,
        }
    except Exception as e:
        logger.error(f"Error cleaning up old alerts: {e}", exc_info=True)
        db.rollback()
        return {
            "status": "error",
            "error": str(e),
        }
    finally:
        db.close()
