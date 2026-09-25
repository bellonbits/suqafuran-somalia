"""Real-time event streaming service for monitoring dashboard."""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from enum import Enum
from dataclasses import dataclass, asdict, field
import asyncio

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Types of events that can be streamed."""
    # Notification events
    NOTIFICATION_SENT = "notification.sent"
    NOTIFICATION_DELIVERED = "notification.delivered"
    NOTIFICATION_FAILED = "notification.failed"

    # Kafka events
    KAFKA_MESSAGE = "kafka.message"
    KAFKA_LAG_CHANGED = "kafka.lag_changed"

    # Order events
    ORDER_CREATED = "order.created"
    ORDER_PAID = "order.paid"
    ORDER_SHIPPED = "order.shipped"
    ORDER_CANCELLED = "order.cancelled"

    # System events
    ALERT_TRIGGERED = "alert.triggered"
    SYSTEM_ERROR = "system.error"


@dataclass
class LiveEvent:
    """Represents a live event to be streamed to clients."""
    event_type: EventType
    timestamp: str
    service: str
    data: Dict[str, Any] = field(default_factory=dict)
    severity: str = "info"  # info, warning, error
    trace_id: Optional[str] = None
    correlation_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "event_type": self.event_type.value,
            "timestamp": self.timestamp,
            "service": self.service,
            "data": self.data,
            "severity": self.severity,
            "trace_id": self.trace_id,
            "correlation_id": self.correlation_id,
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())


class EventStreamManager:
    """Manages active WebSocket connections and event distribution."""

    def __init__(self, max_event_history: int = 100):
        self.connections: Set[asyncio.Queue] = set()
        self.event_history: List[LiveEvent] = []
        self.max_event_history = max_event_history

    async def connect(self, queue: asyncio.Queue) -> None:
        """Register a new client connection."""
        self.connections.add(queue)
        # Send recent event history to new client
        for event in self.event_history[-20:]:
            await queue.put(event)
        logger.info(f"Client connected. Total connections: {len(self.connections)}")

    async def disconnect(self, queue: asyncio.Queue) -> None:
        """Unregister a client connection."""
        self.connections.discard(queue)
        logger.info(f"Client disconnected. Total connections: {len(self.connections)}")

    async def broadcast_event(self, event: LiveEvent) -> None:
        """Broadcast event to all connected clients."""
        # Store in history
        self.event_history.append(event)
        if len(self.event_history) > self.max_event_history:
            self.event_history.pop(0)

        # Send to all connected clients
        disconnected = []
        for queue in self.connections:
            try:
                await queue.put(event)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.append(queue)

        # Clean up disconnected clients
        for queue in disconnected:
            await self.disconnect(queue)

    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.connections)

    def get_event_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent event history."""
        return [event.to_dict() for event in self.event_history[-limit:]]


# Global event stream manager
_event_stream_manager: Optional[EventStreamManager] = None


def get_event_stream_manager() -> EventStreamManager:
    """Get or create singleton event stream manager."""
    global _event_stream_manager
    if _event_stream_manager is None:
        _event_stream_manager = EventStreamManager()
    return _event_stream_manager


async def emit_notification_event(
    event_type: EventType,
    notification_id: str,
    user_id: int,
    channel: str,
    status: str,
    trace_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """Emit a notification event to live stream."""
    manager = get_event_stream_manager()
    event = LiveEvent(
        event_type=event_type,
        timestamp=datetime.utcnow().isoformat(),
        service="notification-service",
        data={
            "notification_id": notification_id,
            "user_id": user_id,
            "channel": channel,
            "status": status,
            "error_message": error_message,
        },
        severity="error" if event_type == EventType.NOTIFICATION_FAILED else "info",
        trace_id=trace_id,
        correlation_id=correlation_id,
    )
    await manager.broadcast_event(event)


async def emit_kafka_event(
    event_type: EventType,
    topic_name: str,
    partition: int,
    lag: Optional[int] = None,
    messages_per_sec: Optional[float] = None,
) -> None:
    """Emit a Kafka event to live stream."""
    manager = get_event_stream_manager()
    event = LiveEvent(
        event_type=event_type,
        timestamp=datetime.utcnow().isoformat(),
        service="kafka-admin",
        data={
            "topic": topic_name,
            "partition": partition,
            "lag": lag,
            "messages_per_sec": messages_per_sec,
        },
        severity="warning" if lag and lag > 1000 else "info",
    )
    await manager.broadcast_event(event)


async def emit_order_event(
    event_type: EventType,
    order_id: str,
    user_id: int,
    amount: Optional[float] = None,
    trace_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> None:
    """Emit an order event to live stream."""
    manager = get_event_stream_manager()
    event = LiveEvent(
        event_type=event_type,
        timestamp=datetime.utcnow().isoformat(),
        service="orders-service",
        data={
            "order_id": order_id,
            "user_id": user_id,
            "amount": amount,
        },
        trace_id=trace_id,
        correlation_id=correlation_id,
    )
    await manager.broadcast_event(event)


async def emit_alert_event(
    rule_id: str,
    alert_name: str,
    message: str,
    severity: str = "warning",
) -> None:
    """Emit an alert event to live stream."""
    manager = get_event_stream_manager()
    event = LiveEvent(
        event_type=EventType.ALERT_TRIGGERED,
        timestamp=datetime.utcnow().isoformat(),
        service="alert-engine",
        data={
            "rule_id": rule_id,
            "alert_name": alert_name,
            "message": message,
        },
        severity=severity,
    )
    await manager.broadcast_event(event)
