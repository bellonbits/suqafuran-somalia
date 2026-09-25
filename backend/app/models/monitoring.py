"""Models for monitoring and alerting system."""

from datetime import datetime
from typing import Optional, Any
from sqlmodel import Field, SQLModel, Column, String, DateTime, JSON, func


class AlertRule(SQLModel, table=True):
    """Alert rule for automated monitoring."""

    __tablename__ = "alert_rules"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=255)
    description: Optional[str] = Field(default=None)
    metric: str = Field(max_length=255)  # kafka_lag, notification_failure_rate, etc.
    threshold: float
    comparison_operator: str = Field(max_length=10)  # >, <, >=, <=, ==
    evaluation_window_minutes: int = Field(default=5)
    aggregation_function: str = Field(default="avg", max_length=50)  # avg, max, sum, count
    metric_filter: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notification_channel: Optional[str] = Field(default=None, max_length=255)  # email, slack, sms
    notification_target: Optional[str] = Field(default=None, max_length=255)
    enabled: bool = Field(default=True, index=True)
    severity: str = Field(default="warning", max_length=50)  # warning, critical

    # Metadata
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now(), onupdate=func.now()),
    )
    created_by: Optional[int] = Field(default=None)

    def __repr__(self):
        return f"<AlertRule {self.id}: {self.name}>"


class AlertHistory(SQLModel, table=True):
    """History of alert incidents."""

    __tablename__ = "alert_history"

    id: Optional[int] = Field(default=None, primary_key=True)
    rule_id: int = Field(foreign_key="alert_rules.id", index=True)
    status: str = Field(max_length=50, index=True)  # firing, resolved
    fired_at: datetime = Field(index=True)
    resolved_at: Optional[datetime] = Field(default=None)
    value: Optional[float] = Field(default=None)  # actual metric value
    message: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )

    def __repr__(self):
        return f"<AlertHistory {self.id}: rule={self.rule_id}, status={self.status}>"


class NotificationLog(SQLModel, table=True):
    """Log of notification delivery attempts."""

    __tablename__ = "notification_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(index=True, max_length=255)
    correlation_id: str = Field(index=True, max_length=255)
    trace_id: Optional[str] = Field(default=None, max_length=255)
    event_type: str = Field(max_length=255)
    channel: str = Field(max_length=50)  # email, sms, push
    provider: str = Field(max_length=50)  # resend, africas_talking, firebase
    user_id: Optional[int] = Field(default=None, index=True)
    status: str = Field(max_length=50, index=True)  # dispatched, sent, failed, pending
    error_message: Optional[str] = Field(default=None)
    dispatched_at: datetime
    delivered_at: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now(), index=True),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now(), onupdate=func.now()),
    )

    def __repr__(self):
        return f"<NotificationLog {self.id}: {self.status}>"


class MonitoringMetricsCache(SQLModel, table=True):
    """Monitoring metrics cache for fast dashboard loads."""

    __tablename__ = "monitoring_metrics_cache"

    id: Optional[int] = Field(default=None, primary_key=True)
    metric_type: str = Field(index=True, max_length=255)  # kafka_topic, notification_rate, etc.
    metric_key: str = Field(max_length=255)  # topic name, event type, etc.
    value: float
    timestamp: datetime = Field(index=True)
    ttl_minutes: int = Field(default=15)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )

    def __repr__(self):
        return f"<MonitoringMetricsCache {self.id}: {self.metric_type}={self.value}>"
