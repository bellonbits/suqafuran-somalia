"""
Celery configuration for async task processing
Handles email, SMS, and push notifications asynchronously
"""
from celery import Celery
from kombu import Queue
from config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "suqafuran",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes hard limit
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    result_expires=3600,  # Results expire after 1 hour
    task_default_retry_delay=60,  # Retry after 60 seconds
    task_max_retries=3,
)

# Configure task routes
celery_app.conf.task_routes = {
    "services.notification_service.send_notification_async": {
        "queue": "notifications",
        "routing_key": "notification.send",
    },
}

# Configure queues
celery_app.conf.task_queues = [
    Queue("notifications", routing_key="notification.*"),
    Queue("marketing", routing_key="marketing.*"),
]

# Configure periodic tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    # Send daily digest emails at 8 AM UTC
    'send-daily-digest': {
        'task': 'app.services.marketing_tasks.send_daily_digest_task',
        'schedule': 86400.0,  # Every 24 hours
        'options': {'queue': 'marketing', 'routing_key': 'marketing.digest'},
        'kwargs': {}
    },
    # Send weekly digest emails every Monday at 8 AM UTC
    'send-weekly-digest': {
        'task': 'app.services.marketing_tasks.send_weekly_digest_task',
        'schedule': 604800.0,  # Every 7 days
        'options': {'queue': 'marketing', 'routing_key': 'marketing.digest'},
        'kwargs': {}
    },
    # Check abandoned listings every 6 hours
    'check-abandoned-listings': {
        'task': 'app.services.marketing_tasks.check_abandoned_listings_task',
        'schedule': 21600.0,  # Every 6 hours
        'options': {'queue': 'marketing', 'routing_key': 'marketing.engagement'},
        'kwargs': {}
    },
    # Check inactive sellers every 12 hours
    'check-inactive-sellers': {
        'task': 'app.services.marketing_tasks.check_inactive_sellers_task',
        'schedule': 43200.0,  # Every 12 hours
        'options': {'queue': 'marketing', 'routing_key': 'marketing.engagement'},
        'kwargs': {}
    },
    # Check saved searches for new listings every 4 hours
    'check-saved-searches': {
        'task': 'app.services.marketing_tasks.check_saved_searches_task',
        'schedule': 14400.0,  # Every 4 hours
        'options': {'queue': 'marketing', 'routing_key': 'marketing.search'},
        'kwargs': {}
    },
    # Send birthday emails daily (checks actual birthdays)
    'send-birthday-emails': {
        'task': 'app.services.marketing_tasks.send_birthday_emails_task',
        'schedule': 86400.0,  # Every 24 hours (at 9 AM UTC)
        'options': {'queue': 'marketing', 'routing_key': 'marketing.special'},
        'kwargs': {}
    },
}
