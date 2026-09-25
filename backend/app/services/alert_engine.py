"""Alert rules engine for monitoring system metrics."""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass, asdict
from sqlmodel import Session, select, func
from app.models.monitoring import AlertRule, AlertHistory
from app.services.event_stream import emit_alert_event, EventType

logger = logging.getLogger(__name__)


class AlertConditionType(str, Enum):
    """Types of alert conditions."""
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    BETWEEN = "between"


class AlertMetricType(str, Enum):
    """Types of metrics that can trigger alerts."""
    NOTIFICATION_FAILURE_RATE = "notification_failure_rate"
    KAFKA_LAG = "kafka_lag"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    ACTIVE_CONNECTIONS = "active_connections"
    QUEUE_DEPTH = "queue_depth"
    PAYMENT_FAILURES = "payment_failures"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class AlertEvaluationResult:
    """Result of evaluating an alert rule."""
    rule_id: int
    rule_name: str
    triggered: bool
    current_value: Optional[float] = None
    threshold_value: Optional[float] = None
    message: Optional[str] = None
    severity: str = "info"


class AlertEngine:
    """Evaluates alert rules against system metrics."""

    def __init__(self, db: Session):
        self.db = db

    async def evaluate_all_rules(self) -> List[AlertEvaluationResult]:
        """Evaluate all active alert rules and return results."""
        try:
            # Get all active rules
            rules = self.db.exec(
                select(AlertRule).where(AlertRule.is_active == True)
            ).all()

            results = []
            for rule in rules:
                result = await self.evaluate_rule(rule)
                results.append(result)

                # If triggered, create alert history and emit event
                if result.triggered:
                    await self.create_alert_history(rule, result)
                    await emit_alert_event(
                        rule_id=str(rule.id),
                        alert_name=rule.name,
                        message=result.message or rule.alert_message,
                        severity=result.severity,
                    )

            return results
        except Exception as e:
            logger.error(f"Error evaluating alert rules: {e}")
            return []

    async def evaluate_rule(self, rule: AlertRule) -> AlertEvaluationResult:
        """Evaluate a single alert rule against current metrics."""
        try:
            # Get current metric value
            metric_value = await self.get_metric_value(rule.metric)

            if metric_value is None:
                return AlertEvaluationResult(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    triggered=False,
                    message="Unable to fetch metric value",
                )

            # Evaluate condition
            triggered = self.evaluate_condition(
                metric_value,
                rule.comparison_operator,
                rule.threshold,
            )

            # Check if already triggered recently (avoid spam)
            if triggered and not self.should_alert(rule):
                triggered = False

            message = self.build_alert_message(
                rule, metric_value, triggered
            )

            return AlertEvaluationResult(
                rule_id=rule.id,
                rule_name=rule.name,
                triggered=triggered,
                current_value=metric_value,
                threshold_value=rule.threshold,
                message=message,
                severity=rule.severity,
            )
        except Exception as e:
            logger.error(f"Error evaluating rule {rule.id}: {e}")
            return AlertEvaluationResult(
                rule_id=rule.id,
                rule_name=rule.name,
                triggered=False,
                message=str(e),
            )

    async def get_metric_value(self, metric_type: str) -> Optional[float]:
        """Get current value for a metric type."""
        try:
            if metric_type == AlertMetricType.NOTIFICATION_FAILURE_RATE.value:
                # Calculate failure rate from notification logs
                from app.models.monitoring import NotificationLog
                total = self.db.exec(
                    select(func.count(NotificationLog.id)).where(
                        NotificationLog.created_at >= datetime.utcnow() - timedelta(hours=1)
                    )
                ).one()
                failed = self.db.exec(
                    select(func.count(NotificationLog.id)).where(
                        NotificationLog.status == "failed",
                        NotificationLog.created_at >= datetime.utcnow() - timedelta(hours=1),
                    )
                ).one()
                return (failed / total * 100) if total > 0 else 0

            elif metric_type == AlertMetricType.ERROR_RATE.value:
                # Calculate error rate from recent errors
                from app.models.monitoring import NotificationLog
                total = self.db.exec(
                    select(func.count(NotificationLog.id)).where(
                        NotificationLog.created_at >= datetime.utcnow() - timedelta(hours=1)
                    )
                ).one()
                errors = self.db.exec(
                    select(func.count(NotificationLog.id)).where(
                        NotificationLog.status == "failed",
                        NotificationLog.created_at >= datetime.utcnow() - timedelta(hours=1),
                    )
                ).one()
                return (errors / total * 100) if total > 0 else 0

            elif metric_type == AlertMetricType.QUEUE_DEPTH.value:
                # Get queue depth from cache or estimate
                from app.models.monitoring import NotificationLog
                pending = self.db.exec(
                    select(func.count(NotificationLog.id)).where(
                        NotificationLog.status == "pending"
                    )
                ).one()
                return float(pending)

            elif metric_type == AlertMetricType.PAYMENT_FAILURES.value:
                # Count payment failures in last hour
                from app.models.payment import Payment
                failures = self.db.exec(
                    select(func.count(Payment.id)).where(
                        Payment.status == "failed",
                        Payment.updated_at >= datetime.utcnow() - timedelta(hours=1),
                    )
                ).one()
                return float(failures)

            # Add more metric types as needed
            return None
        except Exception as e:
            logger.error(f"Error getting metric value for {metric_type}: {e}")
            return None

    @staticmethod
    def evaluate_condition(
        value: float,
        condition: str,
        threshold: float,
    ) -> bool:
        """Evaluate if a value meets the condition."""
        if condition == ">":
            return value > threshold
        elif condition == "<":
            return value < threshold
        elif condition == ">=":
            return value >= threshold
        elif condition == "<=":
            return value <= threshold
        elif condition == "==":
            return value == threshold
        return False

    def should_alert(self, rule: AlertRule) -> bool:
        """Check if enough time has passed to alert again."""
        if rule.cooldown_minutes is None:
            return True

        # Check if there's a recent alert for this rule
        recent_alert = self.db.exec(
            select(AlertHistory)
            .where(AlertHistory.alert_rule_id == rule.id)
            .where(
                AlertHistory.created_at
                >= datetime.utcnow() - timedelta(minutes=rule.cooldown_minutes)
            )
            .order_by(AlertHistory.created_at.desc())
        ).first()

        return recent_alert is None

    @staticmethod
    def build_alert_message(
        rule: AlertRule, current_value: float, triggered: bool
    ) -> str:
        """Build a descriptive alert message."""
        if not triggered:
            return f"{rule.name}: OK (value: {current_value:.2f})"

        return (
            f"{rule.name}: Alert triggered! "
            f"Current value: {current_value:.2f}, "
            f"Threshold: {rule.threshold_value}"
        )

    async def create_alert_history(
        self, rule: AlertRule, result: AlertEvaluationResult
    ) -> AlertHistory:
        """Create an alert history record."""
        try:
            alert = AlertHistory(
                rule_id=rule.id,
                status="firing" if result.triggered else "resolved",
                fired_at=datetime.utcnow(),
                value=result.current_value,
                message=result.message,
            )
            self.db.add(alert)
            self.db.commit()
            self.db.refresh(alert)
            return alert
        except Exception as e:
            logger.error(f"Error creating alert history: {e}")
            self.db.rollback()
            raise

    def get_recent_alerts(
        self, hours: int = 24, limit: int = 50
    ) -> List[AlertHistory]:
        """Get recent alert incidents."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            alerts = self.db.exec(
                select(AlertHistory)
                .where(AlertHistory.created_at >= cutoff_time)
                .order_by(AlertHistory.created_at.desc())
                .limit(limit)
            ).all()
            return alerts
        except Exception as e:
            logger.error(f"Error fetching recent alerts: {e}")
            return []

    def acknowledge_alert(self, alert_id: int) -> bool:
        """Mark an alert as acknowledged."""
        try:
            alert = self.db.get(AlertHistory, alert_id)
            if not alert:
                return False
            alert.acknowledged = True
            alert.acknowledged_at = datetime.utcnow()
            self.db.add(alert)
            self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Error acknowledging alert: {e}")
            self.db.rollback()
            return False


def get_alert_engine(db: Session) -> AlertEngine:
    """Get alert engine instance."""
    return AlertEngine(db)
