"""Monitoring dashboard API endpoints for admin operations."""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlmodel import Session
from pydantic import BaseModel
from app.api import deps
from app.services.kafka_admin import get_kafka_admin, TopicMetrics
from app.services.event_stream import get_event_stream_manager
from app.services.alert_engine import get_alert_engine
from app.models.monitoring import AlertRule, AlertHistory
from database import SessionLocal
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/monitoring", tags=["admin-monitoring"])


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────────────────────

class AlertRuleCreate(BaseModel):
    """Create alert rule request."""
    name: str
    description: Optional[str] = None
    metric: str
    threshold: float
    comparison_operator: str  # >, <, >=, <=, ==
    evaluation_window_minutes: int = 5
    aggregation_function: str = "avg"
    metric_filter: Optional[dict] = None
    notification_channel: Optional[str] = None
    notification_target: Optional[str] = None
    severity: str = "warning"


class AlertRuleUpdate(BaseModel):
    """Update alert rule request."""
    name: Optional[str] = None
    description: Optional[str] = None
    threshold: Optional[float] = None
    comparison_operator: Optional[str] = None
    evaluation_window_minutes: Optional[int] = None
    aggregation_function: Optional[str] = None
    notification_channel: Optional[str] = None
    notification_target: Optional[str] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
# OVERVIEW ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/overview")
async def get_monitoring_overview(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get top-level monitoring overview dashboard data.

    Returns:
    - System health stats (events/sec, notification success rate, etc.)
    - Topic health summary grid
    - Notification funnel mini-chart
    - Recent critical events feed
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        kafka_admin = get_kafka_admin()
        topics = kafka_admin.list_topics()

        # Aggregate Kafka metrics
        total_events_per_sec = 0.0  # Would be computed from time-series data
        total_topics = len(topics)
        lagging_topics = sum(1 for t in topics.values() if t.status == 'lagging')
        stalled_topics = sum(1 for t in topics.values() if t.status == 'stalled')

        # Notification success rate (last 1h)
        from app.models.monitoring import NotificationLog
        now = datetime.utcnow()
        one_hour_ago = now - timedelta(hours=1)

        # notification_success_rate would query the notification_log table
        notification_success_rate = 95.0  # Placeholder

        # Active celery workers (would query Redis)
        active_workers = 12  # Placeholder
        queue_depth = 45  # Placeholder

        # P95 trace latency (would query Jaeger)
        p95_latency_ms = 523  # Placeholder

        # Failed payments (last 1h)
        failed_payments = 0  # Placeholder

        # Open alerts
        open_alerts = 0  # Placeholder

        return {
            "stats": {
                "events_per_sec": total_events_per_sec,
                "notification_success_rate": notification_success_rate,
                "active_workers": active_workers,
                "queue_depth": queue_depth,
                "p95_latency_ms": p95_latency_ms,
                "failed_payments_1h": failed_payments,
                "open_alerts": open_alerts,
            },
            "topic_health": [
                {
                    "name": t.name,
                    "messages_per_sec": t.messages_per_sec,
                    "consumer_lag": t.consumer_lag,
                    "partition_count": t.partition_count,
                    "status": t.status,
                    "last_message_timestamp": t.last_message_timestamp,
                }
                for t in sorted(topics.values(), key=lambda x: x.name)
            ],
            "summary": {
                "total_topics": total_topics,
                "lagging_topics": lagging_topics,
                "stalled_topics": stalled_topics,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in get_monitoring_overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring overview")


# ─────────────────────────────────────────────────────────────────────────────
# KAFKA TOPICS ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/kafka/topics")
async def list_kafka_topics(
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """List all Kafka topics with metrics.

    Returns:
    - List of topics with: name, partition_count, total_messages, messages_per_sec,
      consumer_lag, retention_policy, status
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        kafka_admin = get_kafka_admin()
        topics = kafka_admin.list_topics()

        topics_list = [
            {
                "name": t.name,
                "partition_count": t.partition_count,
                "total_messages": t.total_messages,
                "messages_per_sec": t.messages_per_sec,
                "consumer_lag": t.consumer_lag,
                "consumer_groups": t.consumer_groups,
                "retention_bytes": t.retention_bytes,
                "retention_ms": t.retention_ms,
                "status": t.status,
                "last_message_timestamp": t.last_message_timestamp.isoformat() if t.last_message_timestamp else None,
            }
            for t in sorted(topics.values(), key=lambda x: x.name)
        ]

        return {
            "topics": topics_list,
            "total": len(topics_list),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error listing Kafka topics: {e}")
        raise HTTPException(status_code=500, detail="Failed to list Kafka topics")


@router.get("/kafka/topics/{topic_name}")
async def get_kafka_topic_detail(
    topic_name: str,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get detailed metrics for a specific Kafka topic.

    Args:
        topic_name: Name of the Kafka topic

    Returns:
    - Topic metrics with partition breakdown
    - Time-series data (last 24h) for throughput and lag
    - Sample of recent messages
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        kafka_admin = get_kafka_admin()
        topic = kafka_admin.get_topic_detail(topic_name)

        if not topic:
            raise HTTPException(status_code=404, detail=f"Topic '{topic_name}' not found")

        partitions = kafka_admin.get_partition_metrics(topic_name)

        return {
            "topic": {
                "name": topic.name,
                "partition_count": topic.partition_count,
                "total_messages": topic.total_messages,
                "messages_per_sec": topic.messages_per_sec,
                "consumer_lag": topic.consumer_lag,
                "status": topic.status,
                "retention_bytes": topic.retention_bytes,
                "retention_ms": topic.retention_ms,
            },
            "partitions": [
                {
                    "id": p.partition,
                    "leader": p.leader,
                    "log_end_offset": p.log_end_offset,
                    "committed_offset": p.committed_offset,
                    "lag": p.lag,
                }
                for p in partitions
            ],
            "time_series": {
                "throughput_1h": [],  # Placeholder: would populate from metrics cache
                "lag_1h": [],  # Placeholder
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting topic detail for {topic_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get topic detail")


@router.get("/kafka/topics/{topic_name}/messages")
async def get_kafka_topic_messages(
    topic_name: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    event_type_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get recent messages from a Kafka topic.

    Args:
        topic_name: Name of the topic
        skip: Pagination offset
        limit: Pagination limit (max 500)
        event_type_filter: Filter by event type substring
        status_filter: Filter by 'success' or 'failed'

    Returns:
    - List of recent messages with: event_id, event_type, timestamp, user_id,
      correlation_id, payload preview
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Placeholder: Would read from Kafka topic using a consumer
        # configured to read from the earliest offset, then sample last 50 messages
        # and apply filters

        messages = [
            {
                "event_id": f"evt_{i}",
                "event_type": "order.created",
                "timestamp": (datetime.utcnow() - timedelta(seconds=i*10)).isoformat(),
                "user_id": 12345 + i,
                "correlation_id": f"corr_{i}",
                "trace_id": f"trace_{i}",
                "status": "success" if i % 3 != 0 else "failed",
                "payload_preview": {"order_id": 9000 + i, "amount": 500 + i*10},
            }
            for i in range(limit)
        ]

        return {
            "topic": topic_name,
            "messages": messages,
            "total": len(messages),
            "skip": skip,
            "limit": limit,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting messages for topic {topic_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get topic messages")


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATION DELIVERY MONITORING -- backed by real EmailLog/OTPLog rows
# (see app/services/notification_monitor.py for exactly what's real vs not)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/notifications/channel-stats")
async def get_notification_channel_stats(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Simple email/sms/push counts for the last 24h, for the summary cards."""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.services.notification_monitor import NotificationMetrics

    metrics = NotificationMetrics(db)
    return metrics.get_channel_stats_24h()


@router.get("/notifications/funnel")
async def get_notification_funnel(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    domain: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Get notification delivery funnel data.

    Shows progression through stages: requested → dispatched → sent → delivered
    Grouped by event type and channel.

    Query Params:
    - date_from: Start date (default: 24h ago)
    - date_to: End date (default: now)
    - domain: Filter by domain (auth, catalog, orders, payments, riders)
    - channel: Filter by channel (sms, email, push)
    - event_type: Filter by event type substring
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.notification_monitor import NotificationMetrics

        metrics = NotificationMetrics(db)
        funnel_data = metrics.get_funnel_data(
            date_from=date_from,
            date_to=date_to,
            domain=domain,
            channel=channel,
            event_type=event_type,
        )

        return {
            "funnel": funnel_data,
            "filters": {
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
                "domain": domain,
                "channel": channel,
                "event_type": event_type,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting notification funnel: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notification funnel")


@router.get("/notifications/summary")
async def get_notification_summary(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    channel: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Get notification delivery summary table.

    Returns per-event-type metrics: sent, failed, success rate, avg delivery time.
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.notification_monitor import NotificationMetrics

        metrics = NotificationMetrics(db)
        summary = metrics.get_notification_summary(
            date_from=date_from,
            date_to=date_to,
            channel=channel,
        )

        return {
            "summary": summary,
            "total_sent": sum(s["sent"] for s in summary),
            "total_failed": sum(s["failed"] for s in summary),
            "overall_success_rate": (
                sum(s["sent"] - s["failed"] for s in summary)
                / sum(s["sent"] for s in summary)
                * 100
                if summary
                else 100
            ),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting notification summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notification summary")


@router.get("/notifications/events")
async def get_notification_events(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
) -> Dict[str, Any]:
    """Get paginated list of notification delivery attempts.

    Each row represents one notification sent attempt with delivery status,
    error message if failed, and correlation/trace IDs for debugging.

    Query Params:
    - status: Filter by 'sent', 'failed', 'pending', 'delivered'
    - event_type: Filter by event type substring
    - channel: Filter by 'sms', 'email', 'push'
    - user_id: Filter by user ID
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.notification_monitor import NotificationMetrics

        metrics = NotificationMetrics(db)
        events, total = metrics.get_notification_attempts(
            skip=skip,
            limit=limit,
            status=status,
            event_type=event_type,
            channel=channel,
            user_id=user_id,
        )

        return {
            "events": [
                {
                    **event,
                    "dispatched_at": event["dispatched_at"].isoformat(),
                    "delivered_at": event["delivered_at"].isoformat()
                    if event["delivered_at"]
                    else None,
                }
                for event in events
            ],
            "total": total,
            "skip": skip,
            "limit": limit,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting notification events: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notification events")


@router.post("/notifications/{notification_id}/retry")
async def retry_notification(
    notification_id: str,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Retry a failed notification.

    Re-publishes the notification to the dispatch queue for re-delivery attempt.
    Only works on failed notifications.
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.notification_monitor import NotificationMetrics

        metrics = NotificationMetrics(db)
        result = metrics.retry_notification(notification_id)

        logger.info(
            f"Admin {current_user.id} retried notification {notification_id}",
            extra={"notification_id": notification_id, "admin_id": current_user.id},
        )

        return result
    except Exception as e:
        logger.error(f"Error retrying notification {notification_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retry notification")


@router.get("/traces/search")
async def search_traces(
    current_user: Any = Depends(deps.get_current_active_user),
    trace_id: Optional[str] = Query(None),
    correlation_id: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    order_id: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    operation: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    lookback: str = Query("1h"),
) -> Dict[str, Any]:
    """Search distributed traces by various criteria.

    Queries Jaeger to find traces matching the search criteria.

    Query Params:
    - trace_id: Search by trace ID
    - correlation_id: Search by business correlation ID
    - user_id: Search by user ID
    - order_id: Search by order ID
    - service: Filter by service name
    - operation: Filter by operation name
    - limit: Max results (1-100, default 20)
    - lookback: Time range (1h, 24h, 7d, etc.)
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.jaeger_client import get_jaeger_client

        jaeger = get_jaeger_client()

        # Single trace lookup by trace_id
        if trace_id:
            trace_detail = jaeger.get_trace(trace_id)
            if not trace_detail:
                raise HTTPException(status_code=404, detail="Trace not found")
            return {
                "trace": trace_detail,
                "timestamp": datetime.utcnow().isoformat(),
            }

        # Search by various criteria
        traces = []
        if correlation_id:
            traces = jaeger.search_by_correlation_id(correlation_id, limit, lookback)
        elif user_id:
            traces = jaeger.search_by_user_id(user_id, limit, lookback)
        elif order_id:
            traces = jaeger.search_by_order_id(order_id, limit, lookback)
        elif service or operation:
            traces = jaeger.search_traces(
                service=service,
                operation=operation,
                limit=limit,
                lookback=lookback,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide one of: trace_id, correlation_id, user_id, order_id, or service",
            )

        return {
            "traces": traces,
            "total": len(traces),
            "search_params": {
                "trace_id": trace_id,
                "correlation_id": correlation_id,
                "user_id": user_id,
                "order_id": order_id,
                "service": service,
                "operation": operation,
                "lookback": lookback,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching traces: {e}")
        raise HTTPException(status_code=500, detail="Failed to search traces")


@router.get("/traces/{trace_id}")
async def get_trace_detail(
    trace_id: str,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get detailed trace information including waterfall data.

    Args:
        trace_id: Trace ID to fetch

    Returns:
        Trace detail with all spans and waterfall data for visualization
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from app.services.jaeger_client import get_jaeger_client

        jaeger = get_jaeger_client()
        trace_detail = jaeger.get_trace(trace_id)

        if not trace_detail:
            raise HTTPException(status_code=404, detail="Trace not found")

        return {
            "trace": trace_detail,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trace detail {trace_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get trace detail")


@router.get("/traces/critical-paths")
async def get_critical_paths(
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get predefined critical path templates for quick analysis.

    Returns common critical paths like signup flow, payment flow, etc.
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    critical_paths = [
        {
            "id": "signup_otp_verify",
            "name": "Signup → OTP → Verify",
            "description": "User signup flow with OTP verification",
            "operations": [
                "auth.signup.requested",
                "auth.otp.generated",
                "auth.otp.verified",
            ],
            "key_services": ["auth-service", "otp-service"],
            "typical_duration_ms": 2000,
        },
        {
            "id": "product_create_to_live",
            "name": "Product Creation → Moderation → Live",
            "description": "Product posting flow from creation to going live",
            "operations": [
                "catalog.product.created",
                "catalog.product.moderation_started",
                "catalog.product.moderation_completed",
            ],
            "key_services": ["catalog-service", "moderation-service"],
            "typical_duration_ms": 5000,
        },
        {
            "id": "order_creation_to_payment",
            "name": "Order Creation → Payment → Confirmation",
            "description": "Order flow from creation to successful payment",
            "operations": [
                "orders.order.created",
                "payments.mpesa.initiated",
                "payments.mpesa.confirmed",
                "orders.order.confirmed",
            ],
            "key_services": ["orders-service", "payments-service"],
            "typical_duration_ms": 3000,
        },
        {
            "id": "delivery_assignment_to_pickup",
            "name": "Delivery Assignment → Pickup → Complete",
            "description": "Delivery flow from order assignment to completion",
            "operations": [
                "riders.delivery.assigned",
                "riders.delivery.picked_up",
                "riders.delivery.completed",
            ],
            "key_services": ["riders-service"],
            "typical_duration_ms": 1800000,  # 30 minutes
        },
    ]

    return {
        "critical_paths": critical_paths,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/live/history")
async def get_live_event_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get recent event history from live stream.

    Query Params:
    - limit: Max events to return (1-200, default 50)
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        manager = get_event_stream_manager()
        history = manager.get_event_history(limit)
        return {
            "events": history,
            "total": len(history),
            "active_connections": manager.get_connection_count(),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching event history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch event history")


@router.websocket("/live/ws")
async def websocket_live_events(websocket: WebSocket):
    """WebSocket endpoint for real-time event streaming.

    Sends LiveEvent JSON objects as they occur. Client can subscribe to:
    - Notification events (sent, delivered, failed)
    - Kafka events (message, lag changed)
    - Order events (created, paid, shipped, cancelled)
    - Alert events (triggered)
    - System events (errors)

    Message format:
    {
        "event_type": "notification.sent|kafka.message|order.created|...",
        "timestamp": "2024-07-16T...",
        "service": "notification-service|kafka-admin|orders-service|...",
        "data": {...event-specific data...},
        "severity": "info|warning|error",
        "trace_id": "optional-trace-id",
        "correlation_id": "optional-correlation-id"
    }
    """
    await websocket.accept()
    manager = get_event_stream_manager()
    queue: asyncio.Queue = asyncio.Queue()

    try:
        # Register client
        await manager.connect(queue)

        # Send initial connection message
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to live event stream",
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Listen for events and send to client
        while True:
            event = await queue.get()
            await websocket.send_json(event.to_dict())

    except WebSocketDisconnect:
        await manager.disconnect(queue)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(queue)
        try:
            await websocket.close(code=1000)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# ALERT RULES ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/alerts/rules")
async def list_alert_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """List alert rules with pagination and filtering.

    Query Params:
    - skip: Number to skip (pagination)
    - limit: Max results to return
    - is_active: Filter by active status (optional)
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        query = select(AlertRule)
        if is_active is not None:
            query = query.where(AlertRule.enabled == is_active)

        # Count with same filters
        count_query = select(func.count(AlertRule.id))
        if is_active is not None:
            count_query = count_query.where(AlertRule.enabled == is_active)

        total = db.exec(count_query).one()
        rules = db.exec(query.offset(skip).limit(limit)).all()

        return {
            "rules": [
                {
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "metric": rule.metric,
                    "threshold": rule.threshold,
                    "comparison_operator": rule.comparison_operator,
                    "severity": rule.severity,
                    "enabled": rule.enabled,
                    "created_at": rule.created_at,
                }
                for rule in rules
            ],
            "total": total,
            "skip": skip,
            "limit": limit,
        }
    except Exception as e:
        logger.error(f"Error listing alert rules: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/alerts/rules")
async def create_alert_rule(
    data: AlertRuleCreate,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Create a new alert rule.

    Body:
    - name: Rule name
    - metric: Type of metric to monitor
    - threshold: Threshold value
    - comparison_operator: Condition (>, <, >=, <=, ==)
    - severity: Alert severity (warning, critical)
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        rule = AlertRule(
            name=data.name,
            description=data.description,
            metric=data.metric,
            threshold=data.threshold,
            comparison_operator=data.comparison_operator,
            evaluation_window_minutes=data.evaluation_window_minutes,
            aggregation_function=data.aggregation_function,
            metric_filter=data.metric_filter,
            notification_channel=data.notification_channel,
            notification_target=data.notification_target,
            severity=data.severity,
            created_by=current_user.id,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        return {
            "success": True,
            "message": "Alert rule created successfully",
            "rule_id": rule.id,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating alert rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alerts/rules/{rule_id}")
async def get_alert_rule(
    rule_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get detailed alert rule information."""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    rule = db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    # Get recent incidents for this rule
    recent_alerts = db.exec(
        select(AlertHistory)
        .where(AlertHistory.rule_id == rule_id)
        .order_by(AlertHistory.fired_at.desc())
        .limit(10)
    ).all()

    return {
        "rule": {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "metric": rule.metric,
            "threshold": rule.threshold,
            "comparison_operator": rule.comparison_operator,
            "evaluation_window_minutes": rule.evaluation_window_minutes,
            "severity": rule.severity,
            "enabled": rule.enabled,
            "created_at": rule.created_at,
            "updated_at": rule.updated_at,
        },
        "recent_incidents": [
            {
                "id": alert.id,
                "status": alert.status,
                "value": alert.value,
                "message": alert.message,
                "fired_at": alert.fired_at,
                "resolved_at": alert.resolved_at,
            }
            for alert in recent_alerts
        ],
    }


@router.patch("/alerts/rules/{rule_id}")
async def update_alert_rule(
    rule_id: int,
    data: AlertRuleUpdate,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Update an existing alert rule."""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        rule = db.get(AlertRule, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(rule, key, value)

        db.add(rule)
        db.commit()
        db.refresh(rule)

        return {
            "success": True,
            "message": "Alert rule updated successfully",
            "rule_id": rule.id,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating alert rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/alerts/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Delete an alert rule."""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        rule = db.get(AlertRule, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        db.delete(rule)
        db.commit()

        return {
            "success": True,
            "message": "Alert rule deleted successfully",
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting alert rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alerts/history")
async def get_alert_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    hours: int = Query(24, ge=1, le=7*24),
    acknowledged: Optional[bool] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get alert history with pagination.

    Query Params:
    - skip: Number to skip
    - limit: Max results
    - hours: Look back N hours (1-168)
    - acknowledged: Filter by acknowledgment status
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        query = select(AlertHistory).where(AlertHistory.fired_at >= cutoff_time)

        if acknowledged is not None:
            query = query.where(AlertHistory.status == ("firing" if acknowledged else "resolved"))

        total = db.exec(
            select(func.count(AlertHistory.id)).where(AlertHistory.fired_at >= cutoff_time)
        ).one()

        alerts = db.exec(
            query.order_by(AlertHistory.fired_at.desc()).offset(skip).limit(limit)
        ).all()

        return {
            "alerts": [
                {
                    "id": alert.id,
                    "rule_id": alert.rule_id,
                    "status": alert.status,
                    "value": alert.value,
                    "message": alert.message,
                    "fired_at": alert.fired_at,
                    "resolved_at": alert.resolved_at,
                }
                for alert in alerts
            ],
            "total": total,
            "skip": skip,
            "limit": limit,
            "hours_lookback": hours,
        }
    except Exception as e:
        logger.error(f"Error getting alert history: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/alerts/history/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Mark an alert as resolved."""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        alert = db.get(AlertHistory, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.status = "resolved"
        alert.resolved_at = datetime.utcnow()

        db.add(alert)
        db.commit()

        return {
            "success": True,
            "message": "Alert resolved",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error resolving alert: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alerts/stats")
async def get_alert_stats(
    hours: int = Query(24, ge=1, le=7*24),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Dict[str, Any]:
    """Get alert statistics for the dashboard.

    Query Params:
    - hours: Time range to analyze (1-168)
    """
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        total_alerts = db.exec(
            select(func.count(AlertHistory.id)).where(
                AlertHistory.fired_at >= cutoff_time
            )
        ).one()

        firing_alerts = db.exec(
            select(func.count(AlertHistory.id)).where(
                AlertHistory.fired_at >= cutoff_time,
                AlertHistory.status == "firing",
            )
        ).one()

        resolved_alerts = db.exec(
            select(func.count(AlertHistory.id)).where(
                AlertHistory.fired_at >= cutoff_time,
                AlertHistory.status == "resolved",
            )
        ).one()

        active_rules = db.exec(
            select(func.count(AlertRule.id)).where(AlertRule.enabled == True)
        ).one()

        return {
            "total_alerts": total_alerts,
            "firing_alerts": firing_alerts,
            "resolved_alerts": resolved_alerts,
            "active_rules": active_rules,
            "hours_range": hours,
        }
    except Exception as e:
        logger.error(f"Error getting alert stats: {e}")
        raise HTTPException(status_code=400, detail=str(e))
