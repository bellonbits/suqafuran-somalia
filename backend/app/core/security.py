from datetime import datetime, timedelta
from typing import Any, Union, Optional, List, Dict
from jose import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Request
from app.core.config import settings
from app.models.user import User, TrustLevel
import redis

# Password hashing - support both bcrypt (existing) and argon2 (new)
pwd_context = CryptContext(schemes=["bcrypt", "argon2"], deprecated="auto")

ALGORITHM = settings.JWT_ALGORITHM

# Redis connection for custom rate limiting
# In production, use the URL from settings
try:
    from app.utils.redis import from_url_safe
    redis_client = from_url_safe(settings.REDIS_URL, decode_responses=True)
except Exception:
    # Fallback for local dev if URL is not set
    redis_client = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=settings.REDIS_DB, decode_responses=True)

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def create_session_token(db, user_id: int, request: Optional[Request] = None) -> str:
    """
    Start a login session for one device and return its token. The session
    lasts until logout (see UserSession); revoke_sessions() ends it early.
    """
    import secrets
    from app.models.user_session import UserSession

    session = UserSession(
        id=secrets.token_urlsafe(24),
        user_id=user_id,
        user_agent=(request.headers.get("user-agent", "")[:255] if request else None),
        ip=(request.client.host if request and request.client else None),
    )
    db.add(session)
    db.commit()

    expire = datetime.utcnow() + timedelta(days=settings.SESSION_TOKEN_DAYS)
    return jwt.encode(
        {"exp": expire, "sub": str(user_id), "sid": session.id},
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def revoke_sessions(db, user_id: int, session_id: Optional[str] = None, keep: Optional[str] = None) -> int:
    """
    Revoke one session (session_id) or all of a user's sessions, optionally
    keeping one (keep) -- e.g. the device that just changed the password.
    """
    from sqlmodel import select
    from app.models.user_session import UserSession

    stmt = select(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at == None)  # noqa: E711
    if session_id:
        stmt = stmt.where(UserSession.id == session_id)
    now = datetime.utcnow()
    count = 0
    for s in db.exec(stmt).all():
        if keep and s.id == keep:
            continue
        s.revoked_at = now
        db.add(s)
        count += 1
    db.commit()
    return count


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

class RiskBasedSecurity:
    @staticmethod
    def check_listing_limit(user: User):
        """
        Enforce different listing limits based on trust level.
        """
        key = f"limit:listings:{user.id}"
        try:
            count = redis_client.get(key) or 0
            count = int(count)
            
            # Define limits
            limits = {
                TrustLevel.NEW: 5,        # 5 per day
                TrustLevel.ESTABLISHED: 20,
                TrustLevel.VERIFIED: 100,
                TrustLevel.TRUSTED: 1000
            }
            
            if count >= limits.get(user.trust_level, 5):
                raise HTTPException(status_code=429, detail="Daily listing limit reached for your trust level. Complete verification to increase limits.")
            
            # Increment and set TTL if new
            redis_client.incr(key)
            if count == 0:
                redis_client.expire(key, 86400) # 24 hours
        except redis.RedisError:
            # Fallback if redis is down
            pass

    @staticmethod
    def check_messaging_limit(user: User):
        """
        Prevent spam by limiting message frequency.
        """
        key = f"limit:messages:{user.id}"
        try:
            count = redis_client.get(key) or 0
            count = int(count)
            
            # New/Low Trust users are heavily limited
            if user.trust_score < 100 and count >= 10:
                 raise HTTPException(status_code=429, detail="Message limit reached. Please wait before sending more messages.")
            
            redis_client.incr(key)
            if count == 0:
                redis_client.expire(key, 3600) # 1 hour limit
        except redis.RedisError:
            pass

risk_security = RiskBasedSecurity()
