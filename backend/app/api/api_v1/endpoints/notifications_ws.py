"""
WebSocket endpoint for real-time notifications.
Handles personal notification subscriptions for authenticated users.
"""

from fastapi import APIRouter, Query, Depends, status
from fastapi.websockets import WebSocket
from sqlmodel import Session
from app.db.session import get_db
from app.models import User
from app.core.config import settings
from app.core.logging_config import get_logger
from jose import jwt
from jose.exceptions import JWTError
import json

logger = get_logger("notifications_ws")

router = APIRouter()
ALGORITHM = "HS256"


def verify_token_get_user(token: str, session: Session) -> User | None:
    """Verify token and return authenticated user."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = session.get(User, user_id)
        return user
    except (JWTError, Exception) as e:
        logger.error(f"Token verification failed: {e}")
        return None


@router.websocket("/notifications/ws")
async def websocket_notifications(
    websocket: WebSocket,
    token: str = Query(...),
    session: Session = Depends(get_db),
):
    """
    WebSocket endpoint for real-time notifications.
    Authenticated users connect here to receive live notification updates.

    Message format:
    {
        "type": "notification",
        "payload": {
            "id": "...",
            "title": "...",
            "message": "...",
            "action_url": "...",
            "read": false,
            "created_at": "..."
        }
    }
    """
    try:
        # Verify token and get user
        user = verify_token_get_user(token, session)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return

        await websocket.accept()
        logger.info(f"[Notifications WS] User {user.id} connected")

        # Send connection confirmation
        await websocket.send_json({
            "type": "connection",
            "payload": {
                "status": "connected",
                "user_id": user.id,
                "message": "Successfully connected to notifications"
            }
        })

        # Keep connection alive and listen for messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Echo-like behavior for now - just acknowledge
                # In production, this would handle notification subscriptions
                if message.get("type") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "payload": {"timestamp": str(message.get("timestamp", ""))}
                    })
                else:
                    logger.debug(f"Received message from user {user.id}: {message.get('type')}")

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from user {user.id}")
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "Invalid JSON format"}
                })
            except Exception as e:
                logger.error(f"Error handling message from user {user.id}: {e}")
                break

    except Exception as e:
        logger.error(f"WebSocket error for notifications: {e}")

    finally:
        try:
            await websocket.close()
            logger.info(f"[Notifications WS] Connection closed")
        except Exception:
            pass
