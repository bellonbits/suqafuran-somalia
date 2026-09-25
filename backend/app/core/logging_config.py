import logging
import sys
import structlog
from app.core.config import settings

def setup_logging():
    # Standard library logging configuration
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    # Processors for structlog
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.format_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if settings.ENVIRONMENT == "production":
        # Production: JSON output for Loki/Promtail
        processors = shared_processors + [
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development: Pretty console output
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(),
        ]

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )

def get_logger(name: str):
    return structlog.get_logger(name)

def get_security_logger():
    return structlog.get_logger("security").bind(log_type="security")

def get_audit_logger():
    return structlog.get_logger("audit").bind(log_type="audit")

def get_payment_logger():
    return structlog.get_logger("payment").bind(log_type="payment")
