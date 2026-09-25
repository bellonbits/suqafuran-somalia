from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def client_ip(request: Request) -> str:
    """
    Rate-limit key: the client's IP as seen by our own proxy.

    uvicorn runs with --forwarded-allow-ips=*, which makes request.client the
    *leftmost* X-Forwarded-For entry -- a value the caller controls, so a fresh
    fake IP per request would dodge every limit. The rightmost entry is the one
    appended by our nginx (the address that actually connected to it).
    Note: if a CDN is ever put in front of nginx, this becomes the CDN's IP.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return get_remote_address(request)


# Counts live in Redis so limits hold across all workers/pods (in-memory
# counters are per process). If Redis is unreachable, fall back to in-memory
# counting rather than failing requests.
limiter = Limiter(
    key_func=client_ip,
    storage_uri=settings.REDIS_URL or "memory://",
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)
