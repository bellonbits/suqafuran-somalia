"""
WebSocket Service - Real-time connection management and broadcasting
"""
import json
import logging
from typing import Dict, Set, Optional, List
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections and broadcasting"""

    def __init__(self):
        # Store active connections: {user_id: {connection_id: websocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Store user_id by connection: {connection_id: user_id}
        self.connection_users: Dict[str, str] = {}
        # Store subscribed channels: {connection_id: {order_id, ...}}
        self.subscriptions: Dict[str, Set[str]] = {}
        # Store online users: {user_id: last_seen}
        self.online_users: Dict[str, datetime] = {}

    async def connect(
        self,
        user_id: str,
        connection_id: str,
        websocket: WebSocket,
    ):
        """Register new WebSocket connection"""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}

        self.active_connections[user_id][connection_id] = websocket
        self.connection_users[connection_id] = user_id
        self.online_users[user_id] = datetime.utcnow()
        self.subscriptions[connection_id] = set()

        logger.info(f"User {user_id} connected: {connection_id}")

        # Send connection acknowledgement
        await websocket.send_json(
            {
                "event_type": "connection_ack",
                "connection_id": connection_id,
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    async def disconnect(self, user_id: str, connection_id: str):
        """Unregister WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].pop(connection_id, None)

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        self.connection_users.pop(connection_id, None)
        self.subscriptions.pop(connection_id, None)

        # Mark as offline if no other connections
        if user_id not in self.active_connections:
            self.online_users.pop(user_id, None)
            logger.info(f"User {user_id} disconnected")
        else:
            logger.info(f"User {user_id} connection closed: {connection_id}")

    async def subscribe(self, connection_id: str, channel: str):
        """Subscribe connection to channel (e.g., order_123)"""
        if connection_id in self.subscriptions:
            self.subscriptions[connection_id].add(channel)
            logger.debug(f"Connection {connection_id} subscribed to {channel}")

    async def unsubscribe(self, connection_id: str, channel: str):
        """Unsubscribe connection from channel"""
        if connection_id in self.subscriptions:
            self.subscriptions[connection_id].discard(channel)
            logger.debug(f"Connection {connection_id} unsubscribed from {channel}")

    async def broadcast_to_user(
        self,
        user_id: str,
        message: dict,
        exclude_connection: Optional[str] = None,
    ):
        """Send message to all connections of a user"""
        if user_id not in self.active_connections:
            return

        disconnected = []
        for connection_id, websocket in self.active_connections[user_id].items():
            if exclude_connection and connection_id == exclude_connection:
                continue

            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(
                    f"Error sending message to {user_id}:{connection_id}: {str(e)}"
                )
                disconnected.append(connection_id)

        # Clean up disconnected connections
        for connection_id in disconnected:
            await self.disconnect(user_id, connection_id)

    async def broadcast_to_channel(
        self,
        channel: str,
        message: dict,
        exclude_users: Optional[List[str]] = None,
    ):
        """Send message to all subscribers of a channel"""
        exclude_users = exclude_users or []
        recipients = set()

        for connection_id, subscriptions in self.subscriptions.items():
            if channel in subscriptions:
                user_id = self.connection_users.get(connection_id)
                if user_id and user_id not in exclude_users:
                    recipients.add(user_id)

        for user_id in recipients:
            await self.broadcast_to_user(user_id, message)

    async def broadcast_to_multiple_channels(
        self,
        channels: List[str],
        message: dict,
        exclude_users: Optional[List[str]] = None,
    ):
        """Send message to all subscribers of multiple channels"""
        for channel in channels:
            await self.broadcast_to_channel(channel, message, exclude_users)

    def is_user_online(self, user_id: str) -> bool:
        """Check if user has active connections"""
        return user_id in self.active_connections

    def get_online_users(self) -> List[str]:
        """Get list of online users"""
        return list(self.online_users.keys())

    def get_user_connections(self, user_id: str) -> List[str]:
        """Get all connection IDs for a user"""
        if user_id not in self.active_connections:
            return []
        return list(self.active_connections[user_id].keys())

    def get_connection_info(self, connection_id: str) -> Optional[dict]:
        """Get information about a connection"""
        user_id = self.connection_users.get(connection_id)
        if not user_id:
            return None

        return {
            "connection_id": connection_id,
            "user_id": user_id,
            "subscriptions": list(self.subscriptions.get(connection_id, [])),
            "is_active": True,
        }

    async def send_order_update(
        self,
        order_id: str,
        user_id: str,
        status: str,
        message: Optional[str] = None,
        data: Optional[dict] = None,
    ):
        """Broadcast order status update"""
        message_data = {
            "event_type": "order_update",
            "order_id": order_id,
            "status": status,
            "message": message,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Send to user
        await self.broadcast_to_user(user_id, message_data)

        # Send to order subscribers
        await self.broadcast_to_channel(f"order_{order_id}", message_data)

    async def send_delivery_update(
        self,
        order_id: str,
        rider_id: str,
        latitude: float,
        longitude: float,
        eta_minutes: Optional[int] = None,
        status: str = "delivering",
    ):
        """Broadcast delivery tracking update"""
        message_data = {
            "event_type": "delivery_update",
            "order_id": order_id,
            "rider_id": rider_id,
            "latitude": latitude,
            "longitude": longitude,
            "eta_minutes": eta_minutes,
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Send to order subscribers
        await self.broadcast_to_channel(f"order_{order_id}", message_data)

        # Send to rider subscribers
        await self.broadcast_to_channel(f"rider_{rider_id}", message_data)

    async def send_notification(
        self,
        user_id: str,
        notification_id: str,
        notification_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None,
    ):
        """Broadcast notification to user"""
        message_data = {
            "event_type": "notification",
            "notification_id": notification_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "action_url": action_url,
            "action_label": action_label,
            "timestamp": datetime.utcnow().isoformat(),
        }

        await self.broadcast_to_user(user_id, message_data)

    async def send_payment_update(
        self,
        order_id: str,
        user_id: str,
        status: str,
        amount: float,
        message: Optional[str] = None,
    ):
        """Broadcast payment status update"""
        message_data = {
            "event_type": "payment_update",
            "order_id": order_id,
            "status": status,
            "amount": amount,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
        }

        await self.broadcast_to_user(user_id, message_data)

    async def send_presence_update(
        self,
        user_id: str,
        status: str = "online",
    ):
        """Broadcast user presence update"""
        message_data = {
            "event_type": "presence",
            "user_id": user_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Broadcast to all online users
        for online_user in self.get_online_users():
            await self.broadcast_to_user(online_user, message_data)

    def get_stats(self) -> dict:
        """Get connection statistics"""
        total_users = len(self.active_connections)
        total_connections = sum(
            len(conns) for conns in self.active_connections.values()
        )
        total_subscriptions = sum(
            len(subs) for subs in self.subscriptions.values()
        )

        return {
            "online_users": total_users,
            "active_connections": total_connections,
            "active_subscriptions": total_subscriptions,
            "timestamp": datetime.utcnow().isoformat(),
        }


# Global connection manager instance
manager = ConnectionManager()
