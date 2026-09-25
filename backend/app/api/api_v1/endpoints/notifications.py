import asyncio
import logging
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from jose import jwt
from sqlmodel import Session
from app.api import deps
from app.core import security
from app.core.config import settings
from app.crud.crud_notification import crud_notification
from app.services.kafka_service import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[Any])
def get_my_notifications(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get all notifications for the current user.
    """
    return crud_notification.get_user_notifications(db, user_id=current_user.id)

@router.post("/{notification_id}/read")
def mark_notification_read(
    *,
    db: Session = Depends(deps.get_db),
    notification_id: int,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark a notification as read.
    """
    notification = crud_notification.mark_as_read(
        db, notification_id=notification_id, user_id=current_user.id
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@router.post("/read-all")
def mark_all_notifications_read(
    *,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark all notifications of current user as read.
    """
    count = crud_notification.mark_all_as_read(db, user_id=current_user.id)
    return {"message": "Success", "updated_count": count}

@router.delete("/{notification_id}")
def delete_notification(
    *,
    db: Session = Depends(deps.get_db),
    notification_id: int,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a notification.
    """
    success = crud_notification.remove(db, notification_id=notification_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Success"}


@router.websocket("/ws")
async def notifications_websocket(websocket: WebSocket):
    """
    Personal real-time channel, one per logged-in user (multiple tabs/devices
    all stay connected). Authenticate via ?token=<JWT> query param — browsers'
    native WebSocket API can't send custom headers, so the token travels in
    the URL like the existing business-chat socket does.

    Once connected, the server pushes any event addressed to this user_id
    (e.g. an order status change from a seller) with no polling required.
    """
    print(f"[WebSocket] 🔌 ENDPOINT HIT from {websocket.client}")
    logger.info(f"[WebSocket] 🔌 Connection attempt from {websocket.client}")
    token = websocket.query_params.get("token")
    user_id = None

    if token:
        try:
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM])
            sub = decoded.get("sub")
            # Handle both string and int user IDs
            user_id = int(sub) if sub else None
            logger.info(f"[WebSocket] SUCCESS Token decoded successfully for user {user_id}")
        except Exception as e:
            logger.error(f"[WebSocket] ERROR Token decode failed: {str(e)}, token: {token[:20] if token else 'None'}...")
            user_id = None
    else:
        logger.warning(f"[WebSocket] ⚠️ No token provided in query params")

    if not user_id:
        try:
            await websocket.accept()
            await websocket.send_json({"error": "Unauthorized: invalid or missing token"})
            await websocket.close(code=4401, reason="Invalid token")
        except Exception as e:
            logger.warning(f"[WebSocket] Error rejecting auth: {e}")
        logger.warning(f"[WebSocket] Auth rejected - no token or user_id")
        return

    try:
        await ws_manager.connect_user(user_id, websocket)
        logger.info(f"[WebSocket] Accepted connection for user {user_id}")
    except Exception as e:
        logger.error(f"[WebSocket] Failed to accept connection for user {user_id}: {e}")
        return
    if ws_manager.loop is None:
        ws_manager.set_event_loop(asyncio.get_event_loop())

    try:
        logger.info(f"[WebSocket] User {user_id} connected, listening for messages...")
        while True:
            # This channel is push-only from the server; we just keep the
            # socket open and detect disconnects. Any inbound text (e.g. a
            # client ping) is read and discarded.
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=120)
            except asyncio.TimeoutError:
                # No message for 2 minutes, send a ping to keep alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
            except Exception:
                break
    except WebSocketDisconnect:
        logger.info(f"[WebSocket] User {user_id} disconnected normally")
        ws_manager.disconnect_user(user_id, websocket)
    except Exception as e:
        logger.error(f"[WebSocket] Error for user {user_id}: {e}")
        ws_manager.disconnect_user(user_id, websocket)

