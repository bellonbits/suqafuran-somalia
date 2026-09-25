"""Jaeger client for querying distributed traces via OpenTelemetry."""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# Jaeger query service base URL
JAEGER_QUERY_URL = getattr(settings, "JAEGER_QUERY_URL", "http://localhost:16686")


class JaegerSpan:
    """Represents a single span in a trace."""

    def __init__(self, data: Dict[str, Any]):
        self.data = data

    @property
    def span_id(self) -> str:
        return self.data.get("spanID", "")

    @property
    def trace_id(self) -> str:
        return self.data.get("traceID", "")

    @property
    def operation_name(self) -> str:
        return self.data.get("operationName", "")

    @property
    def service_name(self) -> str:
        return self.data.get("process", {}).get("serviceName", "unknown")

    @property
    def start_time(self) -> int:
        """Start time in microseconds."""
        return self.data.get("startTime", 0)

    @property
    def duration(self) -> int:
        """Duration in microseconds."""
        return self.data.get("duration", 0)

    @property
    def tags(self) -> Dict:
        """Span tags (metadata)."""
        return {tag["key"]: tag["value"] for tag in self.data.get("tags", [])}

    @property
    def logs(self) -> List[Dict]:
        """Span logs (events)."""
        return self.data.get("logs", [])

    @property
    def is_error(self) -> bool:
        """Check if span has error tag."""
        tags = self.tags
        return tags.get("error", False) or tags.get("status.code") == "ERROR"

    @property
    def error_message(self) -> Optional[str]:
        """Get error message if span has error."""
        return self.tags.get("message") or self.tags.get("error.message")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        return {
            "span_id": self.span_id,
            "trace_id": self.trace_id,
            "operation_name": self.operation_name,
            "service_name": self.service_name,
            "start_time": self.start_time,
            "duration": self.duration,
            "duration_ms": self.duration / 1000,
            "tags": self.tags,
            "logs": self.logs,
            "is_error": self.is_error,
            "error_message": self.error_message,
        }


class JaegerTrace:
    """Represents a complete trace with all spans."""

    def __init__(self, data: Dict[str, Any]):
        self.data = data
        self._spans = [JaegerSpan(span_data) for span_data in data.get("spans", [])]

    @property
    def trace_id(self) -> str:
        return self.data.get("traceID", "")

    @property
    def spans(self) -> List[JaegerSpan]:
        return self._spans

    @property
    def span_count(self) -> int:
        return len(self._spans)

    @property
    def service_count(self) -> int:
        services = set(span.service_name for span in self._spans)
        return len(services)

    @property
    def root_span(self) -> Optional[JaegerSpan]:
        """Get the root span (first span by start time)."""
        if not self._spans:
            return None
        return min(self._spans, key=lambda s: s.start_time)

    @property
    def total_duration(self) -> int:
        """Total trace duration in microseconds."""
        if not self._spans:
            return 0
        min_start = min(s.start_time for s in self._spans)
        max_end = max(s.start_time + s.duration for s in self._spans)
        return max_end - min_start

    @property
    def total_duration_ms(self) -> float:
        """Total trace duration in milliseconds."""
        return self.total_duration / 1000

    @property
    def has_errors(self) -> bool:
        """Check if any span in trace has errors."""
        return any(span.is_error for span in self._spans)

    @property
    def error_spans(self) -> List[JaegerSpan]:
        """Get all spans with errors."""
        return [span for span in self._spans if span.is_error]

    def get_span_by_id(self, span_id: str) -> Optional[JaegerSpan]:
        """Get span by ID."""
        for span in self._spans:
            if span.span_id == span_id:
                return span
        return None

    def get_spans_by_service(self, service_name: str) -> List[JaegerSpan]:
        """Get all spans for a specific service."""
        return [s for s in self._spans if s.service_name == service_name]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        return {
            "trace_id": self.trace_id,
            "total_duration_ms": self.total_duration_ms,
            "span_count": self.span_count,
            "service_count": self.service_count,
            "has_errors": self.has_errors,
            "error_count": len(self.error_spans),
            "spans": [span.to_dict() for span in self._spans],
            "error_spans": [span.to_dict() for span in self.error_spans],
        }


class JaegerClient:
    """Client for querying Jaeger via HTTP API."""

    def __init__(self, base_url: str = JAEGER_QUERY_URL):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=30)

    def search_traces(
        self,
        service: Optional[str] = None,
        operation: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
        limit: int = 20,
        lookback: str = "1h",
    ) -> List[Dict[str, Any]]:
        """Search for traces by service, operation, and tags.

        Args:
            service: Service name filter
            operation: Operation name filter
            tags: Key-value tags filter (Jaeger query format: "key:value")
            limit: Maximum traces to return
            lookback: Time range (e.g., "1h", "24h")

        Returns:
            List of trace summaries
        """
        try:
            params = {
                "limit": limit,
                "lookback": lookback,
            }
            if service:
                params["service"] = service
            if operation:
                params["operation"] = operation

            # Build tag query string
            if tags:
                tag_queries = [f"{k}:{v}" for k, v in tags.items()]
                params["tags"] = " ".join(tag_queries)

            response = self.client.get(
                f"{self.base_url}/api/traces",
                params=params,
            )
            response.raise_for_status()

            data = response.json()
            traces = []
            for trace_data in data.get("data", []):
                trace = JaegerTrace(trace_data)
                traces.append({
                    "trace_id": trace.trace_id,
                    "total_duration_ms": trace.total_duration_ms,
                    "span_count": trace.span_count,
                    "service_count": trace.service_count,
                    "has_errors": trace.has_errors,
                    "error_count": len(trace.error_spans),
                })
            return traces
        except Exception as e:
            logger.error(f"Error searching Jaeger traces: {e}")
            return []

    def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed trace by ID.

        Args:
            trace_id: Trace ID to fetch

        Returns:
            Trace detail dictionary or None if not found
        """
        try:
            response = self.client.get(
                f"{self.base_url}/api/traces/{trace_id}",
            )
            response.raise_for_status()

            data = response.json()
            if not data.get("data"):
                return None

            trace = JaegerTrace(data["data"][0])
            return trace.to_dict()
        except Exception as e:
            logger.error(f"Error fetching Jaeger trace {trace_id}: {e}")
            return None

    def search_by_correlation_id(
        self,
        correlation_id: str,
        limit: int = 20,
        lookback: str = "24h",
    ) -> List[Dict[str, Any]]:
        """Search traces by correlation_id tag.

        Args:
            correlation_id: Correlation ID to search for
            limit: Maximum traces to return
            lookback: Time range

        Returns:
            List of matching traces
        """
        return self.search_traces(
            tags={"correlation_id": correlation_id},
            limit=limit,
            lookback=lookback,
        )

    def search_by_user_id(
        self,
        user_id: int,
        limit: int = 20,
        lookback: str = "24h",
    ) -> List[Dict[str, Any]]:
        """Search traces by user_id tag.

        Args:
            user_id: User ID to search for
            limit: Maximum traces to return
            lookback: Time range

        Returns:
            List of matching traces
        """
        return self.search_traces(
            tags={"user_id": str(user_id)},
            limit=limit,
            lookback=lookback,
        )

    def search_by_order_id(
        self,
        order_id: str,
        limit: int = 20,
        lookback: str = "24h",
    ) -> List[Dict[str, Any]]:
        """Search traces by order_id tag.

        Args:
            order_id: Order ID to search for
            limit: Maximum traces to return
            lookback: Time range

        Returns:
            List of matching traces
        """
        return self.search_traces(
            tags={"order_id": order_id},
            limit=limit,
            lookback=lookback,
        )

    def close(self):
        """Close HTTP client."""
        self.client.close()


# Singleton instance
_jaeger_client: Optional[JaegerClient] = None


def get_jaeger_client() -> JaegerClient:
    """Get or create singleton Jaeger client."""
    global _jaeger_client
    if _jaeger_client is None:
        _jaeger_client = JaegerClient()
    return _jaeger_client
