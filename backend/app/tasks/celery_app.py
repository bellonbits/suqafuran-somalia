from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "suqafuran",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.notification_tasks",
        "app.tasks.promotion_tasks",
        "app.tasks.email_tasks",
        "app.tasks.alert_tasks",
        "app.tasks.subscription_tasks",
        "app.tasks.retention_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,
    task_acks_late=True,          # Only ack after task completes (safer)
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1, # Don't prefetch — fair distribution
    worker_send_task_events=True,
    task_send_sent_event=True,
    task_routes={
        "app.tasks.promotion_tasks.*": {"queue": "promotions"},
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.tasks.email_tasks.*": {"queue": "default"},
    },
    beat_scheduler="celery.beat:PersistentScheduler",
    beat_dburi="sqlite:////app/celerybeat/celerybeat.db",
    beat_schedule={
        # Expire stale promotions that never got paid — every hour
        "expire-stale-promotions": {
            "task": "app.tasks.promotion_tasks.expire_stale_promotions",
            "schedule": 3600.0,
        },
        # Retry failed STK pushes — every 5 minutes
        "retry-failed-stk-pushes": {
            "task": "app.tasks.promotion_tasks.retry_failed_stk_pushes",
            "schedule": 300.0,
        },
        # Evaluate alert rules — every 5 minutes
        "evaluate-alert-rules": {
            "task": "evaluate_alert_rules",
            "schedule": 300.0,
        },
        # Cleanup old alerts — daily at 2 AM UTC
        "cleanup-old-alerts": {
            "task": "cleanup_old_alerts",
            "schedule": 86400.0,  # Once per day
            "kwargs": {"days": 30},
        },
        # Downgrade sellers whose subscription/trial has ended, and notify them — every 15 minutes
        "expire-ended-subscriptions": {
            "task": "app.tasks.subscription_tasks.expire_ended_subscriptions",
            "schedule": 900.0,
        },
        # Promotional/lifecycle campaign rotation — daily at 09:00 UTC. The
        # weekly frequency cap and per-campaign cooldowns are enforced inside
        # the task itself (rotation_engine.py), not by this schedule.
        "run-promotional-rotation": {
            "task": "app.tasks.email_tasks.run_promotional_rotation",
            "schedule": crontab(hour=9, minute=0),
        },
        # Drip-feed admin broadcast campaigns — every 30 minutes. The
        # per-job daily_limit is enforced inside the task itself, so running
        # this often just means a job resumes promptly if it was paused
        # (e.g. worker restart) rather than waiting a full day.
        "process-broadcast-jobs": {
            "task": "app.tasks.email_tasks.process_broadcast_jobs",
            "schedule": 1800.0,
        },
        # Nudge buyers who viewed a listing but never messaged the seller
        # about it — hourly. The task's own 3-24h window and CampaignSendLog
        # dedup mean running it often just catches new candidates promptly,
        # not repeated sends.
        "send-viewed-no-contact-reminders": {
            "task": "app.tasks.email_tasks.send_viewed_no_contact_reminders",
            "schedule": 3600.0,
        },
        # ── RETENTION FUNNEL ─────────────────────────────────────────────────────
        # Cross-sell: 7 days after delivery — daily at 10:00 UTC
        "retention-cross-sell": {
            "task": "app.tasks.retention_tasks.send_cross_sell_reminders",
            "schedule": crontab(hour=10, minute=0),
        },
        # Replenishment: consumable products, 14 days after delivery — 10:30 UTC
        "retention-replenishment": {
            "task": "app.tasks.retention_tasks.send_replenishment_reminders",
            "schedule": crontab(hour=10, minute=30),
        },
        # Win-back soft: 45-day lapse — daily at 11:00 UTC
        "retention-winback-soft": {
            "task": "app.tasks.retention_tasks.send_winback_soft",
            "schedule": crontab(hour=11, minute=0),
        },
        # Win-back offer: 90-day lapse with 10% coupon — daily at 11:30 UTC
        "retention-winback-offer": {
            "task": "app.tasks.retention_tasks.send_winback_offer",
            "schedule": crontab(hour=11, minute=30),
        },
        # Purchase anniversary coupons — daily at 09:00 UTC
        "retention-anniversary": {
            "task": "app.tasks.retention_tasks.send_anniversary_coupons",
            "schedule": crontab(hour=9, minute=0),
        },
    },
)
