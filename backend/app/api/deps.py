from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.db.session import Session as DbSession, engine
from app.models.user import User
from app.core.limiter import limiter
import structlog

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token",
    auto_error=False
)


def get_db() -> Generator:
    with DbSession(engine) as session:
        yield session


def session_is_active(db: Session, payload: dict) -> bool:
    """
    Tokens with a session id ("sid") are valid only while that session hasn't
    been revoked (logout / password change). Tokens issued before sessions
    existed have no sid and stay valid until their own expiry.
    """
    sid = payload.get("sid")
    if not sid:
        return True
    from app.models.user_session import UserSession
    session = db.get(UserSession, sid)
    return bool(session and session.revoked_at is None and str(session.user_id) == str(payload.get("sub")))


def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = payload.get("sub")
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, token_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not session_is_active(db, payload):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has ended. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    structlog.contextvars.bind_contextvars(
        user_id=user.id,
        user_email=user.email,
        is_admin=user.is_admin
    )

    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2),
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = payload.get("sub")
        if not token_data:
            return None
    except (jwt.JWTError, ValidationError):
        return None

    if not session_is_active(db, payload):
        return None
    user = db.get(User, token_data)
    if user:
        structlog.contextvars.bind_contextvars(
            user_id=user.id,
            user_email=user.email,
            is_admin=user.is_admin
        )
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin and not current_user.is_agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges"
        )
    return current_user


def get_current_active_agent(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_agent and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges"
        )
    return current_user

def get_current_admin_only(
    current_user: User = Depends(get_current_user),
) -> User:
    """Admins only -- unlike get_current_active_superuser, agents are refused.
    Use for money-affecting actions such as manually confirming a payment."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges"
        )
    return current_user


# Alias for admin endpoints
get_current_admin_user = get_current_active_superuser
get_current_agent_user = get_current_active_agent
get_current_active_admin = get_current_active_superuser


def get_current_user_from_token(token: str, db: Session = Depends(get_db)) -> Optional[User]:
    """
    Authenticate user from a token string (used in WebSocket).
    Returns None if authentication fails, raises no exception.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = payload.get("sub")
        if not token_data:
            return None
    except (jwt.JWTError, ValidationError):
        return None

    if not session_is_active(db, payload):
        return None
    user = db.get(User, token_data)
    return user


def get_current_session_id(token: Optional[str] = Depends(reusable_oauth2)) -> Optional[str]:
    """The session id inside the caller's token (None for older tokens)."""
    if not token:
        return None
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]).get("sid")
    except (jwt.JWTError, ValidationError):
        return None
