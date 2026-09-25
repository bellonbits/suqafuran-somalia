import secrets
import string
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks, Request, UploadFile, File
from sqlmodel import Session
from app.api import deps
from app.core import security
from app.crud import crud_user
from app.models.user import UserCreate, User, UserUpdate, PasswordChange, UserResponse
from app.utils.email import send_verification_email
from app.utils.redis import set_verification_code, get_verification_code, delete_verification_code
from app.services.storage_service import storage_service

router = APIRouter()


def generate_verification_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


@router.post("/signup", response_model=UserResponse)
@deps.limiter.limit("5/minute;30/hour")
def create_user_signup(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    request: Request,
    background_tasks: BackgroundTasks
) -> Any:
    """
    Create new user without the need to be logged in.
    """
    from sqlmodel import func, select
    from datetime import datetime, timedelta

    # Layer 1.1: Capture Signals
    fingerprint = request.headers.get("X-Device-Fingerprint")
    ip = request.client.host

    # Layer 1.2: Anti-Bulk Defenses
    # 1. IP Limit: Max 3 per 24h
    one_day_ago = datetime.utcnow() - timedelta(days=1)
    ip_count = db.exec(
        select(func.count(User.id)).where(User.last_ip == ip, User.created_at >= one_day_ago)
    ).one()
    if ip_count >= 3:
        raise HTTPException(status_code=429, detail="Too many accounts created from this IP. Try again tomorrow.")

    # 2. Device Limit: Max 2 per 30 days
    if fingerprint:
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        fp_count = db.exec(
            select(func.count(User.id)).where(User.device_fingerprint == fingerprint, User.created_at >= thirty_days_ago)
        ).one()
        if fp_count >= 2:
            raise HTTPException(status_code=429, detail="Too many accounts created from this device. Try again next month.")
    user = crud_user.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email address already exists in the system",
        )
    if user_in.phone:
        existing_phone = crud_user.get_user_by_phone(db, phone=user_in.phone)
        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail="An account with this phone number already exists.",
            )
    user = crud_user.create_user(db, user_in=user_in)
    
    # Save signals
    user.last_ip = ip
    user.device_fingerprint = fingerprint
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Generate and send verification code
    code = generate_verification_code()
    set_verification_code(user.email, code)
    background_tasks.add_task(send_verification_email, user.email, code)
    
    return user


@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.get("/public/{user_id}", response_model=dict)
def read_user_public(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
) -> Any:
    """
    Get public information for a user.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "full_name": user.full_name,
        "business_name": user.business_name,
        "id": user.id,
        "is_verified": user.is_verified,
        "avatar_url": user.avatar_url,
        "phone": user.phone,
        "response_time": user.response_time,
        "trust_score": user.trust_score,
        "trust_level": user.trust_level
    }


@router.post("/public/{user_id}/view")
def track_user_view(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
) -> Any:
    """
    Increment profile views for a user.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.profile_views += 1
    db.add(user)
    db.commit()
    return {"message": "View tracked"}


@router.patch("/me", response_model=UserResponse)
def update_user_me(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    request: Request,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Update own user.
    """
    from app.services.email_service import email_service
    from datetime import datetime as _datetime

    update_data = user_in.model_dump(exclude_unset=True)
    notify_email = current_user.email
    name = current_user.full_name or "Customer"
    timestamp = _datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    ip = request.client.host if request.client else "Unknown"

    password_changed = bool(update_data.get("password"))
    changed_contact_fields = []
    if update_data.get("email") and update_data["email"] != current_user.email:
        changed_contact_fields.append("email address")
    if update_data.get("phone") and update_data["phone"] != current_user.phone:
        changed_contact_fields.append("phone number")

    try:
        user = crud_user.update_user(db, db_obj=current_user, user_in=user_in)
    except ValueError as err:
        err_code = str(err)
        if err_code == "PHONE_ALREADY_EXISTS":
            raise HTTPException(status_code=400, detail="This phone number is already registered to another account.")
        elif err_code == "EMAIL_ALREADY_EXISTS":
            raise HTTPException(status_code=400, detail="This email address is already registered to another account.")
        elif err_code == "BUSINESS_NAME_ALREADY_EXISTS":
            raise HTTPException(status_code=400, detail="A shop or business with this name already exists. Please choose a unique name.")
        else:
            raise HTTPException(status_code=400, detail=err_code)

    if password_changed:
        background_tasks.add_task(
            email_service.send_password_change_alert, notify_email, name, timestamp, ip, user.id
        )
    if changed_contact_fields:
        background_tasks.add_task(
            email_service.send_profile_updated_email, notify_email, name, changed_contact_fields, timestamp, user.id
        )

    return user


@router.put("/me/seller-settings")
def update_seller_settings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    free_delivery: bool = Body(None, embed=True),
    is_featured: bool = Body(None, embed=True),
) -> Any:
    """
    Update seller delivery and featured settings.
    Sellers can toggle whether they offer free delivery and if they want to be featured.
    """
    if free_delivery is not None:
        current_user.free_delivery = free_delivery
    if is_featured is not None:
        current_user.is_featured = is_featured

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "status": "ok",
        "free_delivery": current_user.free_delivery,
        "is_featured": current_user.is_featured,
    }


@router.put("/me/device-token")
def update_device_token(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    device_token: str = Body(..., embed=True),
) -> Any:
    """Save or update the FCM push notification token for the current user's device."""
    current_user.fcm_token = device_token
    db.add(current_user)
    db.commit()
    return {"status": "ok"}


@router.delete("/me/device-token")
def remove_device_token(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Remove FCM token on logout so the user stops receiving push notifications."""
    current_user.fcm_token = None
    db.add(current_user)
    db.commit()
    return {"status": "ok"}


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload user avatar to Cloudinary.
    """
    # Read file content
    content = await file.read()

    # Upload to Cloudinary or local storage
    avatar_url, _ = await storage_service.upload_file(content, file.filename or "avatar.jpg")

    # Update user avatar_url and sync to logo_url for shop cards
    current_user.avatar_url = avatar_url
    current_user.logo_url = avatar_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return current_user


@router.delete("/me")
def delete_user_me(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Permanently delete the current user's account and all associated data.
    Deletes in FK-safe order: child rows first, then the user row.
    """
    from sqlmodel import select
    from app.models.audit import AuditLog
    from app.models.notification import Notification
    from app.models.favorite import Favorite
    from app.models.message import Message
    from app.models.interaction import Interaction
    from app.models.trust import Rating, Report
    from app.models.verification import VerificationRequest
    from app.models.wallet import Wallet, Transaction, Voucher
    from app.models.listing import Listing
    from app.models.promotion import Promotion

    uid = current_user.id
    # Captured before the row is deleted below -- current_user is detached
    # from the session (and its fields unusable) once db.commit() runs.
    deleted_email = current_user.email
    deleted_name = current_user.full_name or "Customer"

    # 1. Audit logs
    for row in db.exec(select(AuditLog).where(AuditLog.user_id == uid)).all():
        db.delete(row)

    # 2. Notifications
    for row in db.exec(select(Notification).where(Notification.user_id == uid)).all():
        db.delete(row)

    # 2. Favorites
    for row in db.exec(select(Favorite).where(Favorite.user_id == uid)).all():
        db.delete(row)

    # 3. Messages (sender or receiver)
    for row in db.exec(select(Message).where(
        (Message.sender_id == uid) | (Message.receiver_id == uid)
    )).all():
        db.delete(row)

    # 4. Interactions (buyer)
    for row in db.exec(select(Interaction).where(Interaction.buyer_id == uid)).all():
        db.delete(row)

    # 5. Trust ratings & reports
    for row in db.exec(select(Rating).where(
        (Rating.rater_id == uid) | (Rating.rated_user_id == uid)
    )).all():
        db.delete(row)
    for row in db.exec(select(Report).where(Report.reporter_id == uid)).all():
        db.delete(row)

    # 6. Verification requests
    for row in db.exec(select(VerificationRequest).where(VerificationRequest.user_id == uid)).all():
        db.delete(row)

    # 7. Vouchers redeemed by this user (nullify reference, keep voucher)
    for row in db.exec(select(Voucher).where(Voucher.redeemed_by_id == uid)).all():
        row.redeemed_by_id = None
        db.add(row)

    # 8. Wallet transactions → wallet
    wallet = db.exec(select(Wallet).where(Wallet.user_id == uid)).first()
    if wallet:
        for row in db.exec(select(Transaction).where(Transaction.wallet_id == wallet.id)).all():
            db.delete(row)
        db.delete(wallet)

    # 9. Listings and their promotions
    listings = db.exec(select(Listing).where(Listing.owner_id == uid)).all()
    for listing in listings:
        for row in db.exec(select(Promotion).where(Promotion.listing_id == listing.id)).all():
            db.delete(row)
        for row in db.exec(select(Favorite).where(Favorite.listing_id == listing.id)).all():
            db.delete(row)
        for row in db.exec(select(Message).where(Message.listing_id == listing.id)).all():
            db.delete(row)
        for row in db.exec(select(Interaction).where(Interaction.listing_id == listing.id)).all():
            db.delete(row)
        db.delete(listing)

    # 10. Finally delete the user
    db.delete(current_user)
    db.commit()

    from app.services.email_service import email_service
    background_tasks.add_task(email_service.send_account_deleted_email, deleted_email, deleted_name, uid)

    return {"message": "Account deleted successfully"}


@router.post("/me/change-password")
@deps.limiter.limit("10/minute")
def change_password(
    *,
    db: Session = Depends(deps.get_db),
    password_in: PasswordChange,
    current_user: User = Depends(deps.get_current_active_user),
    current_sid: Optional[str] = Depends(deps.get_current_session_id),
    request: Request,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Change own password. Signs out every other device (this one stays in).
    """
    if not crud_user.authenticate(db, email=current_user.email, password=password_in.current_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    crud_user.update_user(db, db_obj=current_user, user_in=UserUpdate(password=password_in.new_password))
    security.revoke_sessions(db, current_user.id, keep=current_sid)

    from app.services.email_service import email_service
    from datetime import datetime as _datetime

    ip = request.client.host if request.client else "Unknown"
    timestamp = _datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    background_tasks.add_task(
        email_service.send_password_change_alert,
        current_user.email, current_user.full_name or "Customer", timestamp, ip, current_user.id
    )

    return {"message": "Password changed successfully"}


@router.post("/verify-email")
@deps.limiter.limit("20/minute")
def verify_email(
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    email: str = Body(...),
    code: str = Body(...),
) -> Any:
    """
    Verify email with code.
    """
    stored_code = get_verification_code(email)
    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    
    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    crud_user.verify_user(db, db_obj=user)
    delete_verification_code(email)
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
@deps.limiter.limit("5/minute;30/hour")
def resend_verification(
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    email: str = Body(..., embed=True),
    background_tasks: BackgroundTasks
) -> Any:
    """
    Resend verification code.
    """
    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_verified:
        return {"message": "Email is already verified"}
    
    code = generate_verification_code()
    set_verification_code(email, code)
    background_tasks.add_task(send_verification_email, email, code)
    
    return {"message": "Verification code resent"}


@router.post("/forgot-password")
@deps.limiter.limit("5/minute;30/hour")
def forgot_password(
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    email: str = Body(..., embed=True),
    background_tasks: BackgroundTasks
) -> Any:
    """
    Send password reset code.
    """
    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        # We don't want to leak if a user exists
        return {"message": "If an account exists with this email, a reset code has been sent"}
    
    code = generate_verification_code()
    from app.utils.redis import set_reset_token
    from app.services.email_service import email_service

    set_reset_token(email, code)
    background_tasks.add_task(email_service.send_reset_code, email, code)
    
    return {"message": "Password reset code sent"}


@router.post("/reset-password")
@deps.limiter.limit("10/minute")
def reset_password(
    *,
    db: Session = Depends(deps.get_db),
    email: str = Body(...),
    code: str = Body(...),
    new_password: str = Body(...),
    request: Request,
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Reset password using code.
    """
    from app.utils.redis import get_reset_token, delete_reset_token
    from app.services.cache_service import cache

    # Cap wrong guesses per email (the per-IP limit alone can be spread over
    # many IPs): after 5 misses the code is burned and a new one is needed.
    attempts_key = f"reset_attempts:{email.strip().lower()}"
    try:
        attempts = int(cache.client.incr(attempts_key))
        cache.client.expire(attempts_key, 900)
    except Exception:
        attempts = 0
    if attempts > 5:
        delete_reset_token(email)
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new reset code.")

    stored_code = get_reset_token(email)
    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    try:
        cache.client.delete(attempts_key)
    except Exception:
        pass

    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    crud_user.update_user(db, db_obj=user, user_in=UserUpdate(password=new_password))
    delete_reset_token(email)
    # Whoever knew the old password is signed out everywhere
    security.revoke_sessions(db, user.id)

    from app.services.email_service import email_service
    from datetime import datetime as _datetime

    ip = request.client.host if request.client else "Unknown"
    timestamp = _datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    background_tasks.add_task(
        email_service.send_password_change_alert,
        user.email, user.full_name or "Customer", timestamp, ip, user.id
    )

    return {"message": "Password reset successfully"}


@router.get("/me/security-log")
def get_my_security_log(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    The current user's own security activity: real security alert emails
    (password changes, new-device logins, account protection notices) plus
    every device that's ever been linked to this account. Backs the
    /security-logs page.
    """
    from sqlmodel import select
    from app.models.email_log import EmailLog
    from app.models.device import Device, UserDeviceLink

    SECURITY_EMAIL_TYPES = [
        "safety_password_change", "safety_suspicious_login",
        "safety_protection", "safety_scam_warning",
    ]

    alert_rows = db.exec(
        select(EmailLog)
        .where(EmailLog.user_id == current_user.id, EmailLog.email_type.in_(SECURITY_EMAIL_TYPES))
        .order_by(EmailLog.sent_at.desc())
        .limit(100)
    ).all()

    device_rows = db.exec(
        select(Device, UserDeviceLink.created_at)
        .join(UserDeviceLink, UserDeviceLink.device_id == Device.id)
        .where(UserDeviceLink.user_id == current_user.id)
        .order_by(Device.last_seen_at.desc())
    ).all()

    return {
        "alerts": [
            {
                "id": row.id,
                "type": row.email_type,
                "subject": row.subject,
                "status": row.status,
                "at": row.sent_at,
            }
            for row in alert_rows
        ],
        "devices": [
            {
                "id": device.id,
                "first_seen_at": first_seen,
                "last_seen_at": device.last_seen_at,
                "is_banned": device.is_banned,
                "metadata": device.device_metadata or {},
            }
            for device, first_seen in device_rows
        ],
    }
