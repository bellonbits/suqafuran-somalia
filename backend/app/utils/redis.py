import redis
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def from_url_safe(url: str, **kwargs) -> redis.Redis:
    """
    Creates a Redis client that is resilient to password authentication mismatches.
    If the Redis server has no password configured but we passed a password,
    it catches the ResponseError and automatically falls back to connecting without a password.
    """
    client = redis.from_url(url, **kwargs)
    try:
        # Test connection immediately
        client.ping()
        return client
    except (redis.exceptions.AuthenticationError, redis.exceptions.ResponseError) as e:
        err_msg = str(e)
        if "without any password configured" in err_msg or "no password is set" in err_msg or "invalid password" in err_msg:
            logger.warning("Redis password authentication failed (server password mismatch). Falling back to passwordless connection.")
            # Construct a passwordless URL
            fallback_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
            fallback_client = redis.from_url(fallback_url, **kwargs)
            try:
                fallback_client.ping()
                return fallback_client
            except Exception as fe:
                logger.error(f"Redis passwordless fallback failed: {fe}")
                raise fe
        else:
            raise e
    except Exception:
        # If connection is down entirely, return the client and let operations fail gracefully
        return client

redis_client = from_url_safe(settings.REDIS_URL, decode_responses=True)

def set_verification_code(email: str, code: str, expire_hours: int = 24):
    email = email.strip().lower()
    redis_client.setex(f"verify:{email}", expire_hours * 3600, code)

def get_verification_code(email: str) -> str:
    email = email.strip().lower()
    return redis_client.get(f"verify:{email}")

def delete_verification_code(email: str):
    email = email.strip().lower()
    redis_client.delete(f"verify:{email}")

def set_reset_token(email: str, token: str, expire_hours: int = 1):
    email = email.strip().lower()
    redis_client.setex(f"reset:{email}", expire_hours * 3600, token)

def get_reset_token(email: str) -> str:
    email = email.strip().lower()
    return redis_client.get(f"reset:{email}")

def delete_reset_token(email: str):
    email = email.strip().lower()
    redis_client.delete(f"reset:{email}")
