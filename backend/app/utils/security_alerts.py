"""Best-effort account-security email alerts triggered from real request handlers."""

import datetime
from typing import Optional, Tuple
from fastapi import Request, BackgroundTasks
from sqlmodel import Session, select
from app.models.user import User


def _extract_client_signals(request: Request) -> Tuple[Optional[str], Optional[str], str]:
    ip = request.client.host if request.client else None
    fingerprint = request.headers.get("X-Device-Fingerprint")
    user_agent = request.headers.get("user-agent", "Unknown device")
    return ip, fingerprint, user_agent


def link_signup_device(db: Session, user: User, request: Request) -> None:
    """Record the device used at account creation as the user's baseline
    known device, so their very next login from the same browser/app isn't
    mistaken for a new one."""
    ip, fingerprint, user_agent = _extract_client_signals(request)
    if not fingerprint:
        return

    from app.services.security_service import security_service

    device = security_service.get_or_create_device(db, fingerprint, {"user_agent": user_agent, "ip": ip})
    security_service.link_user_to_device(db, user, device)


def notify_if_new_device(db: Session, user: User, request: Request, background_tasks: BackgroundTasks) -> None:
    """Alert the user when they sign in from a device we haven't seen linked
    to their account before.

    Uses the same Device/UserDeviceLink tables the fraud/security pipeline
    already maintains (security_service.py), keyed off the browser/app
    fingerprint the frontend already sends on every request
    (X-Device-Fingerprint). This is real multi-device recognition, not just
    an IP check -- switching between a known phone and laptop won't
    re-trigger the alert every time, unlike a plain IP comparison would.
    Falls back to comparing against User.last_ip only if a client doesn't
    send a fingerprint at all.
    """
    if not user.email or user.email.endswith("@suqafuran.local"):
        return

    ip, fingerprint, user_agent = _extract_client_signals(request)
    is_new_device = False

    if fingerprint:
        from app.models.device import UserDeviceLink
        from app.services.security_service import security_service

        device = security_service.get_or_create_device(db, fingerprint, {"user_agent": user_agent, "ip": ip})
        existing_link = db.exec(
            select(UserDeviceLink).where(
                UserDeviceLink.user_id == user.id,
                UserDeviceLink.device_id == device.id,
            )
        ).first()
        has_other_known_devices = db.exec(
            select(UserDeviceLink).where(UserDeviceLink.user_id == user.id)
        ).first() is not None

        if not existing_link and has_other_known_devices:
            is_new_device = True

        security_service.link_user_to_device(db, user, device)
    elif user.last_ip and ip and user.last_ip != ip:
        # No fingerprint header on this request (unusual client) -- fall
        # back to a plain IP comparison against the last IP we saw.
        is_new_device = True

    if is_new_device and ip:
        from app.services.email_service import email_service

        timestamp = datetime.datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
        background_tasks.add_task(
            email_service.send_new_device_login_alert,
            user.email, user.full_name or "Customer", user_agent, ip, timestamp, ip, user.id
        )

    if ip and user.last_ip != ip:
        user.last_ip = ip
        db.add(user)
        db.commit()
