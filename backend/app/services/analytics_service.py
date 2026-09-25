"""
Analytics Service - Track user interactions and events.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select, func
from app.models.subscription_features import AnalyticsEvent
from app.core.logging_config import get_logger

logger = get_logger("analytics")


class AnalyticsService:
    """Track and aggregate analytics events."""

    # Event types
    EVENT_TYPES = [
        "shop_visit",
        "product_view",
        "product_click",
        "whatsapp_click",
        "call_click",
        "message_click",
        "follow_shop",
    ]

    def track_event(
        self,
        seller_id: int,
        event_type: str,
        listing_id: Optional[int] = None,
        source: Optional[str] = None,  # "search", "category", "homepage", "direct"
        search_query: Optional[str] = None,
        user_id: Optional[int] = None,
        session: Optional[Session] = None,
    ) -> bool:
        """
        Track an analytics event.

        Args:
            seller_id: The shop owner's ID
            event_type: Type of event (shop_visit, product_view, etc)
            listing_id: Product listing being interacted with
            source: Where the visitor came from
            search_query: Search term if from search
            user_id: The user performing the action
            session: Database session

        Returns:
            True if event was tracked
        """
        if event_type not in self.EVENT_TYPES:
            logger.warning(f"Unknown event type: {event_type}")
            return False

        try:
            event = AnalyticsEvent(
                seller_id=seller_id,
                listing_id=listing_id,
                event_type=event_type,
                source=source,
                search_query=search_query,
                user_id=user_id,
            )

            session.add(event)
            session.commit()

            return True

        except Exception as e:
            logger.error(f"Failed to track event: {str(e)}")
            return False

    def get_seller_metrics(
        self,
        seller_id: int,
        days: int = 30,
        session: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Get aggregated metrics for a seller over a period.

        Args:
            seller_id: The shop owner's ID
            days: Number of days to look back (default 30)
            session: Database session

        Returns:
            Dictionary of metrics
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get all events for this seller in the period
        events = session.exec(
            select(AnalyticsEvent).where(
                AnalyticsEvent.seller_id == seller_id,
                AnalyticsEvent.created_at >= cutoff_date,
            )
        ).all()

        # Count by event type
        event_counts = {}
        for event_type in self.EVENT_TYPES:
            count = len([e for e in events if e.event_type == event_type])
            event_counts[event_type] = count

        # Count by source
        source_counts = {}
        for event in events:
            source = event.source or "direct"
            source_counts[source] = source_counts.get(source, 0) + 1

        # Unique visitors (approximation by unique user_ids)
        unique_visitors = len(set(e.user_id for e in events if e.user_id))

        # Search queries
        search_queries = {}
        for event in events:
            if event.search_query:
                search_queries[event.search_query] = search_queries.get(event.search_query, 0) + 1

        # Sort search queries by frequency
        top_searches = sorted(
            search_queries.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]

        return {
            "period_days": days,
            "total_events": len(events),
            "shop_visits": event_counts.get("shop_visit", 0),
            "product_views": event_counts.get("product_view", 0),
            "product_clicks": event_counts.get("product_click", 0),
            "whatsapp_clicks": event_counts.get("whatsapp_click", 0),
            "call_clicks": event_counts.get("call_click", 0),
            "message_clicks": event_counts.get("message_click", 0),
            "follows": event_counts.get("follow_shop", 0),
            "unique_visitors": unique_visitors,
            "by_source": source_counts,
            "top_search_queries": [
                {"query": q, "count": c} for q, c in top_searches
            ],
        }

    def get_daily_metrics(
        self,
        seller_id: int,
        days: int = 30,
        session: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """Get daily breakdown of metrics."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        events = session.exec(
            select(AnalyticsEvent).where(
                AnalyticsEvent.seller_id == seller_id,
                AnalyticsEvent.created_at >= cutoff_date,
            ).order_by(AnalyticsEvent.created_at)
        ).all()

        # Group by date
        daily_data = {}
        for event in events:
            date_key = event.created_at.date().isoformat()
            if date_key not in daily_data:
                daily_data[date_key] = {
                    "date": date_key,
                    "shop_visits": 0,
                    "product_views": 0,
                    "product_clicks": 0,
                    "whatsapp_clicks": 0,
                    "call_clicks": 0,
                    "message_clicks": 0,
                    "follows": 0,
                }

            if event.event_type == "shop_visit":
                daily_data[date_key]["shop_visits"] += 1
            elif event.event_type == "product_view":
                daily_data[date_key]["product_views"] += 1
            elif event.event_type == "product_click":
                daily_data[date_key]["product_clicks"] += 1
            elif event.event_type == "whatsapp_click":
                daily_data[date_key]["whatsapp_clicks"] += 1
            elif event.event_type == "call_click":
                daily_data[date_key]["call_clicks"] += 1
            elif event.event_type == "message_click":
                daily_data[date_key]["message_clicks"] += 1
            elif event.event_type == "follow_shop":
                daily_data[date_key]["follows"] += 1

        return sorted(daily_data.values(), key=lambda x: x["date"])

    def get_product_metrics(
        self,
        seller_id: int,
        listing_id: int,
        days: int = 30,
        session: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Get metrics for a specific product."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        events = session.exec(
            select(AnalyticsEvent).where(
                AnalyticsEvent.seller_id == seller_id,
                AnalyticsEvent.listing_id == listing_id,
                AnalyticsEvent.created_at >= cutoff_date,
            )
        ).all()

        event_counts = {}
        for event_type in self.EVENT_TYPES:
            count = len([e for e in events if e.event_type == event_type])
            event_counts[event_type] = count

        return {
            "listing_id": listing_id,
            "period_days": days,
            "total_events": len(events),
            "views": event_counts.get("product_view", 0),
            "clicks": event_counts.get("product_click", 0),
            "whatsapp_clicks": event_counts.get("whatsapp_click", 0),
            "call_clicks": event_counts.get("call_click", 0),
            "message_clicks": event_counts.get("message_click", 0),
            "ctr": round(
                (event_counts.get("product_click", 0) / max(event_counts.get("product_view", 1), 1)) * 100,
                2
            ),  # Click-through rate
        }


# Singleton instance
analytics_service = AnalyticsService()
