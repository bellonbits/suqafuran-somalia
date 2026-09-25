from datetime import timedelta
from typing import Any
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, BackgroundTasks
from pydantic import BaseModel
from sqlmodel import Session
from app.api import deps
from app.core import security
from app.core.config import settings
from app.crud import crud_user
from app.services.kafka_producer import publish_signin_event
from app.utils.security_alerts import notify_if_new_device

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


LOGIN_MAX_FAILURES = 10
LOGIN_LOCK_SECONDS = 15 * 60


@router.post("/login/access-token")
@deps.limiter.limit("20/minute;200/hour")
async def login_access_token(
    response: Response,
    credentials: LoginRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    JSON login endpoint, get an access token for future requests
    """
    # Per-account lockout: IP limits alone don't stop a password-guessing
    # attack spread over many IPs. Fails open if Redis is unavailable.
    from app.services.cache_service import cache
    fail_key = f"login_fail:{credentials.email.strip().lower()}"
    try:
        failures = int(cache.client.get(fail_key) or 0)
    except Exception:
        failures = 0
    if failures >= LOGIN_MAX_FAILURES:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again in 15 minutes or reset your password.",
        )

    user = crud_user.authenticate(
        db, email=credentials.email, password=credentials.password
    )
    if not user:
        try:
            pipe = cache.client.pipeline()
            pipe.incr(fail_key)
            pipe.expire(fail_key, LOGIN_LOCK_SECONDS)
            pipe.execute()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    try:
        cache.client.delete(fail_key)
    except Exception:
        pass
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    elif not user.email_verified:
        raise HTTPException(
            status_code=400,
            detail="Email not verified. Please check your inbox for the verification code."
        )

    notify_if_new_device(db, user, request, background_tasks)

    access_token = security.create_session_token(db, user.id, request)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.SESSION_TOKEN_DAYS * 86400,
        samesite="lax",
        secure=False,
    )

    # Publish signin event to Kafka (non-blocking)
    logger.info(f"🔔 Attempting to publish signin event for user {user.id} ({user.email})")
    try:
        result = await publish_signin_event(
            user_id=user.id,
            email=user.email,
            auth_method="password",
            full_name=user.full_name,
        )
        logger.info(f"✅ Signin event published: {result}")
    except Exception as e:
        logger.error(f"❌ Failed to publish signin event: {e}", exc_info=True)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
        }
    }
