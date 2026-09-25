"""
FCM push notification sender using firebase-admin SDK.

Requires:
  - pip install firebase-admin
  - FIREBASE_CREDENTIALS_PATH env var pointing to your serviceAccountKey.json
    OR FIREBASE_CREDENTIALS_JSON env var with the JSON string directly.

Until google-services.json / credentials are added, all sends are no-ops
(logged as warnings, never crash the request).
"""

import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    try:
        import firebase_admin
        from firebase_admin import credentials

        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
        elif cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        else:
            logger.warning("Push: Firebase credentials not configured — push disabled.")
            return None

        if not firebase_admin._apps:
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            _firebase_app = firebase_admin.get_app()

        return _firebase_app

    except ImportError:
        logger.warning("Push: firebase-admin not installed — push disabled.")
        return None
    except Exception as e:
        logger.error(f"Push: Firebase init failed — {e}")
        return None


def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> bool:
    """
    Send a push notification to a single device.
    Returns True on success, False on any failure (never raises).
    """
    if not fcm_token:
        return False

    app = _get_app()
    if app is None:
        return False

    try:
        from firebase_admin import messaging

        msg = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url,
            ),
            data={str(k): str(v) for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    sound="default",
                    click_action="FLUTTER_NOTIFICATION_CLICK",
                ),
            ),
        )
        messaging.send(msg, app=app)
        logger.info(f"Push sent → {fcm_token[:20]}… | {title}")
        return True

    except Exception as e:
        logger.error(f"Push send failed: {e}")
        return False


def send_push_to_user(db, user_id: int, title: str, body: str, data: Optional[dict] = None) -> bool:
    """Convenience: look up user's FCM token from DB and send."""
    try:
        from sqlmodel import select
        from app.models.user import User

        user = db.exec(select(User).where(User.id == user_id)).first()
        if not user or not user.fcm_token:
            return False
        return send_push(user.fcm_token, title, body, data)
    except Exception as e:
        logger.error(f"send_push_to_user error: {e}")
        return False
