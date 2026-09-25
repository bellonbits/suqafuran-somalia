"""
Kafka + WebSocket Integration Service - Shops Focus

Architecture:
  Backend API → Kafka Producer → Kafka Topic → Kafka Consumer → WebSocket Broadcast → Connected Clients

This service connects Kafka event streaming with WebSocket real-time delivery for shops.
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.services.kafka_service import kafka_service, ws_manager
from app.core.config import settings

logger = logging.getLogger("kafka_websocket_integration")


class KafkaWebSocketBridge:
    """Bridges Kafka events to WebSocket clients - Shops Focus."""

    # Event type to WebSocket action mapping
    EVENT_ROUTING = {
        # Shop Events
        "SHOP_CREATED": {
            "action": "shop_update",
            "channels": lambda payload: [f"shop_{payload.get('shop_id')}"],
            "recipients": lambda payload: [payload.get("user_id")],
        },
        "SHOP_UPDATED": {
            "action": "shop_update",
            "channels": lambda payload: [f"shop_{payload.get('shop_id')}"],
            "recipients": lambda payload: [payload.get("user_id")],
        },

        # Order Events
        "ORDER_PLACED": {
            "action": "order_update",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id")],
        },
        "ORDER_STATUS_UPDATED": {
            "action": "order_status",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id")],
        },
        "ORDER_CONFIRMED": {
            "action": "order_confirmed",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id")],
        },

        # Delivery Events
        "DELIVERY_ASSIGNED": {
            "action": "delivery_update",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id"), payload.get("rider_id")],
        },
        "DELIVERY_LOCATION_UPDATE": {
            "action": "delivery_location",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id")],
        },
        "DELIVERY_COMPLETED": {
            "action": "delivery_completed",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id")],
        },

        # Payment Events
        "PAYMENT_PROCESSED": {
            "action": "payment_update",
            "channels": lambda payload: [
                f"order_{payload.get('order_id')}",
                f"shop_{payload.get('shop_id')}"
            ],
            "recipients": lambda payload: [payload.get("buyer_id"), payload.get("seller_id")],
        },

        # Shop Product Events
        "PRODUCT_CREATED": {
            "action": "product_update",
            "channels": lambda payload: [f"shop_{payload.get('shop_id')}"],
            "recipients": lambda payload: [payload.get("seller_id")],
        },
        "PRODUCT_UPDATED": {
            "action": "product_update",
            "channels": lambda payload: [f"shop_{payload.get('shop_id')}"],
            "recipients": lambda payload: [payload.get("seller_id")],
        },

        # Inventory Events
        "STOCK_LOW": {
            "action": "inventory_alert",
            "channels": lambda payload: [f"shop_{payload.get('shop_id')}"],
            "recipients": lambda payload: [payload.get("seller_id")],
        },

        # Rating/Review Events
        "REVIEW_RECEIVED": {
            "action": "review_update",
            "channels": lambda payload: [f"shop_{payload.get('shop_id')}"],
            "recipients": lambda payload: [payload.get("seller_id")],
        },

        # Shop Message Events
        "SHOP_MESSAGE_RECEIVED": {
            "action": "new_message",
            "channels": lambda payload: [
                f"shop_chat_{payload.get('shop_id')}",
                f"user_{payload.get('recipient_id')}"
            ],
            "recipients": lambda payload: [payload.get("recipient_id")],
        },
    }

    @staticmethod
    async def bridge_kafka_to_websocket(event_type: str, payload: Dict[str, Any], timestamp: str) -> None:
        """
        Route Kafka event to WebSocket clients.

        Args:
            event_type: Type of event (ORDER_PLACED, STOCK_LOW, etc.)
            payload: Event payload with details
            timestamp: ISO format timestamp
        """
        try:
            # Skip if no routing defined
            if event_type not in KafkaWebSocketBridge.EVENT_ROUTING:
                logger.debug(f"No WebSocket routing for event type: {event_type}")
                return

            routing = KafkaWebSocketBridge.EVENT_ROUTING[event_type]
            action = routing["action"]

            # Get channels and recipients
            channels = routing["channels"](payload) if callable(routing["channels"]) else routing["channels"]
            recipients = routing["recipients"](payload) if callable(routing["recipients"]) else routing["recipients"]

            # Build WebSocket message
            ws_message = {
                "event_type": event_type,
                "action": action,
                "payload": payload,
                "timestamp": timestamp,
            }

            # Broadcast to all subscribed channels
            for channel in channels:
                await ws_manager.broadcast_to_channel(channel, ws_message)
                logger.info(f"Broadcast {event_type} to channel {channel}")

            # Send direct notifications to specific users
            for user_id in recipients:
                if user_id:  # Skip None/empty
                    await ws_manager.broadcast_to_user(int(user_id), ws_message)
                    logger.info(f"Sent {event_type} notification to user {user_id}")

        except Exception as e:
            logger.error(f"Error bridging Kafka event to WebSocket: {e}", exc_info=True)


def integrate_kafka_with_websocket():
    """
    Hook Kafka events into WebSocket broadcasting.
    Call this during app startup.
    """

    # Patch kafka_service event handlers to also broadcast via WebSocket
    original_dispatch = kafka_service._dispatch_event

    async def dispatch_with_websocket(event_type: str, payload: dict, db_session_factory):
        """Enhanced event dispatcher that also broadcasts via WebSocket."""
        # First, do original database operations
        original_dispatch(event_type, payload, db_session_factory)

        # Then broadcast via WebSocket
        timestamp = datetime.utcnow().isoformat()
        await KafkaWebSocketBridge.bridge_kafka_to_websocket(event_type, payload, timestamp)

    # Replace the dispatcher
    kafka_service._dispatch_event = dispatch_with_websocket

    logger.info("Kafka + WebSocket integration enabled")


# Example: How to trigger shop events from your API endpoints

async def trigger_shop_event(shop_id: str, user_id: int, event_type: str, data: dict = None):
    """
    Example: Shop update event

    Broadcasts shop updates to all connected clients
    """
    event_payload = {
        "shop_id": shop_id,
        "user_id": user_id,
        **(data or {}),
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Send to Kafka + WebSocket
    kafka_service.send_event(event_type, event_payload, key=str(shop_id))


async def trigger_order_event(order_id: str, shop_id: str, buyer_id: int, seller_id: int, status: str):
    """
    Example: Order status update

    Notifies both buyer and seller via WebSocket + Kafka audit trail
    """
    event_payload = {
        "order_id": order_id,
        "shop_id": shop_id,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "status": status,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Send to Kafka + WebSocket
    kafka_service.send_event("ORDER_STATUS_UPDATED", event_payload, key=str(order_id))


async def trigger_delivery_event(order_id: str, shop_id: str, buyer_id: int, seller_id: int, rider_id: int, latitude: float, longitude: float, eta: int):
    """
    Example: Delivery location update

    Real-time GPS tracking to buyer and seller
    """
    event_payload = {
        "order_id": order_id,
        "shop_id": shop_id,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "rider_id": rider_id,
        "latitude": latitude,
        "longitude": longitude,
        "eta_minutes": eta,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Send to Kafka + WebSocket
    kafka_service.send_event("DELIVERY_LOCATION_UPDATE", event_payload, key=str(order_id))


async def trigger_payment_event(order_id: str, shop_id: str, buyer_id: int, seller_id: int, amount: float, status: str):
    """
    Example: Payment confirmation

    Notify both parties of payment status
    """
    event_payload = {
        "order_id": order_id,
        "shop_id": shop_id,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "amount": amount,
        "status": status,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Send to Kafka + WebSocket
    kafka_service.send_event("PAYMENT_PROCESSED", event_payload, key=str(order_id))


async def trigger_shop_message_event(shop_id: str, sender_id: int, recipient_id: int, message: str):
    """
    Example: Shop message notification

    Send message updates to shop customers/sellers
    """
    event_payload = {
        "shop_id": shop_id,
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Send to Kafka + WebSocket
    kafka_service.send_event("SHOP_MESSAGE_RECEIVED", event_payload, key=str(shop_id))


async def trigger_inventory_event(shop_id: str, seller_id: int, product_id: str, product_name: str, stock_level: int):
    """
    Example: Low stock alert

    Alert shop owner when inventory is low
    """
    event_payload = {
        "shop_id": shop_id,
        "seller_id": seller_id,
        "product_id": product_id,
        "product_name": product_name,
        "stock_level": stock_level,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Send to Kafka + WebSocket
    kafka_service.send_event("STOCK_LOW", event_payload, key=str(shop_id))
