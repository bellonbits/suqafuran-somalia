from datetime import datetime, timedelta
from typing import Any, Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, BackgroundTasks
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from app.api import deps
from app.core import security
from app.core.config import settings
from app.crud import crud_user
from app.models.user import User, UserVerifiedLevel
from app.models.audit import AuditLog
from app.models.marketing_code import MarketingCode
from app.services.email_service import email_service
from app.services.africastalking_service import africastalking_service
from app.services.kafka_producer import publish_signup_event, publish_signin_event
from app.services.marketing_service import marketing_service
from app.models.marketing import EmailEventType
from app.utils.security_alerts import notify_if_new_device, link_signup_device
from pydantic import BaseModel
from app.core.metrics import USER_REGISTRATIONS_TOTAL, SUCCESSFUL_LOGINS_TOTAL

logger = logging.getLogger(__name__)

router = APIRouter()

class RequestOtpIn(BaseModel):
    email: str

class RequestOtpOut(BaseModel):
    success: bool
    cooldown_seconds: int = 60

class VerifyOtpIn(BaseModel):
    email: str
    otp: str

class SignupIn(BaseModel):
    full_name: str
    email: str
    password: str
    phone: Optional[str] = None
    promo_code: Optional[str] = None

class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Any

@router.post("/request-otp", response_model=RequestOtpOut)
@deps.limiter.limit("5/minute")
def request_otp(
    request: Request,
    payload: RequestOtpIn,
    db: Session = Depends(deps.get_db)
) -> Any:
    success = email_service.send_verification_code(payload.email)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code. Please try again later."
        )
    return {"success": True, "cooldown_seconds": 60}


@router.post("/signup", response_model=RequestOtpOut)
@deps.limiter.limit("3/minute")
def signup(
    request: Request,
    payload: SignupIn,
    db: Session = Depends(deps.get_db)
) -> Any:
    existing = crud_user.get_user_by_email(db, email=payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if payload.phone:
        existing_phone = crud_user.get_user_by_phone(db, phone=payload.phone)
        if existing_phone:
            raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    signup_data = {"full_name": payload.full_name, "email": payload.email, "password": payload.password, "phone": payload.phone, "promo_code": payload.promo_code}
    stored = email_service.store_pending_signup(payload.email, signup_data)
    if not stored:
        raise HTTPException(status_code=500, detail="Failed to store signup data. Please try again.")

    success = email_service.send_verification_code(payload.email)
    if not success:
        email_service.delete_pending_signup(payload.email)
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please try again.")

    return {"success": True, "cooldown_seconds": 60}


@router.post("/verify-otp", response_model=AuthOut)
@deps.limiter.limit("20/minute")
async def verify_otp(
    response: Response,
    payload: VerifyOtpIn,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db)
) -> Any:
    is_valid = email_service.check_verification_code(payload.email, payload.otp)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = crud_user.get_user_by_email(db, email=payload.email)

    if not user:
        signup_data = email_service.get_pending_signup(payload.email)
        if not signup_data:
            raise HTTPException(status_code=400, detail="Signup session expired. Please sign up again.")
        try:
            user = crud_user.create_user(
                db,
                email=signup_data["email"],
                password=signup_data["password"],
                full_name=signup_data["full_name"],
                phone=signup_data.get("phone"),
            )
            user.email_verified = True
            user.phone_verified = True
            # Promote to tier1 after email verification
            user.verified_level = UserVerifiedLevel.tier1

            # Apply marketing promo code if present and valid
            promo_code_val = signup_data.get("promo_code")
            if promo_code_val:
                code_upper = promo_code_val.strip().upper()
                mc = db.exec(select(MarketingCode).where(MarketingCode.code == code_upper)).first()
                if mc and mc.is_active and (mc.max_uses is None or mc.uses_count < mc.max_uses):
                    user.referral_code = code_upper
                    mc.uses_count += 1
                    db.add(mc)

            db.add(user)
            db.add(AuditLog(
                user_id=user.id, action="USER_SIGNUP", resource_type="user",
                resource_id=user.id,
                details=f"New user: {user.full_name} ({user.email})" + (f" via promo: {user.referral_code}" if user.referral_code else "")
            ))
            db.commit()
            db.refresh(user)
            link_signup_device(db, user, request)

            # Send signup email via marketing automation
            try:
                await marketing_service.send_event_email(
                    session=db,
                    user_id=user.id,
                    event_type=EmailEventType.SIGNUP,
                    context={
                        "first_name": user.full_name.split()[0] if user.full_name else "User",
                        "complete_profile_link": f"{settings.FRONTEND_URL}/settings/profile",
                        "create_shop_link": f"{settings.FRONTEND_URL}/shops/create",
                        "post_listing_link": f"{settings.FRONTEND_URL}/dashboard/listings",
                        "download_app_link": "https://suqafuran.com/app"
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to send signup marketing email: {e}")

            # Send welcome email
            email_service.send_welcome_email(user.email, user.full_name, user.id)

            # Publish signup event to Kafka (non-blocking)
            try:
                await publish_signup_event(
                    user_id=user.id,
                    email=user.email,
                    phone=user.phone,
                    promo_code=user.referral_code,
                )
            except Exception as e:
                logger.warning(f"Failed to publish signup event: {e}")

            # Track business metric
            USER_REGISTRATIONS_TOTAL.labels(method="email_otp").inc()
        except IntegrityError as e:
            db.rollback()
            email_service.delete_pending_signup(payload.email)
            if "ix_user_phone" in str(e.orig):
                raise HTTPException(status_code=400, detail="An account with this phone number already exists.")
            raise HTTPException(status_code=400, detail="Account creation failed. Please try again.")
        email_service.delete_pending_signup(payload.email)
    else:
        user.email_verified = True
        user.phone_verified = True
        user.verified_level = UserVerifiedLevel.tier1
        db.add(user)
        db.add(AuditLog(
            user_id=user.id, action="USER_LOGIN", resource_type="user",
            resource_id=user.id, details=f"User {user.full_name} logged in via email OTP"
        ))
        db.commit()
        db.refresh(user)

        notify_if_new_device(db, user, request, background_tasks)

        # Publish signin event to Kafka (non-blocking)
        logger.info(f"🔔 Attempting to publish signin event for user {user.id} ({user.email})")
        try:
            result = await publish_signin_event(
                user_id=user.id,
                email=user.email,
                auth_method="email_otp",
                full_name=user.full_name,
            )
            logger.info(f"✅ Signin event published: {result}")
        except Exception as e:
            logger.error(f"❌ Failed to publish signin event: {e}", exc_info=True)

        # Track business metric
        SUCCESSFUL_LOGINS_TOTAL.inc()

    access_token = security.create_session_token(db, user.id, request)

    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        max_age=settings.SESSION_TOKEN_DAYS * 86400,
        samesite="lax", secure=False,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.full_name, "email": user.email}
    }


# ─── Phone OTP (Africa's Talking SMS) ───────────────────────────────────────

class RequestPhoneOtpIn(BaseModel):
    phone: str

class SignupPhoneIn(BaseModel):
    full_name: str
    phone: str
    promo_code: str | None = None

class VerifyPhoneOtpIn(BaseModel):
    phone: str
    otp: str


@router.post("/signup-phone", response_model=RequestOtpOut)
@deps.limiter.limit("3/minute")
def signup_phone(
    request: Request,
    payload: SignupPhoneIn,
    db: Session = Depends(deps.get_db),
) -> Any:
    try:
        phone = africastalking_service.normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number format.")

    existing = db.exec(select(User).where(User.phone == phone)).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    signup_data = {"full_name": payload.full_name, "phone": phone, "promo_code": payload.promo_code}
    africastalking_service.store_pending_signup(phone, signup_data)
    success = africastalking_service.send_verification_code(phone)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS. Please try again.")
    return {"success": True, "cooldown_seconds": 60}


@router.post("/request-phone-otp", response_model=RequestOtpOut)
@deps.limiter.limit("5/minute")
def request_phone_otp(
    request: Request,
    payload: RequestPhoneOtpIn,
    db: Session = Depends(deps.get_db),
) -> Any:
    try:
        phone = africastalking_service.normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number format.")

    success = africastalking_service.send_verification_code(phone)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS. Please try again.")
    return {"success": True, "cooldown_seconds": 60}


@router.post("/verify-phone-otp", response_model=AuthOut)
@deps.limiter.limit("20/minute")
async def verify_phone_otp(
    response: Response,
    payload: VerifyPhoneOtpIn,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
) -> Any:
    try:
        phone = africastalking_service.normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number format.")

    is_valid = africastalking_service.check_verification_code(phone, payload.otp)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    user = db.exec(select(User).where(User.phone == phone)).first()

    if not user:
        # Check for a pending phone signup
        signup_data = africastalking_service.get_pending_signup(phone)
        if not signup_data:
            raise HTTPException(
                status_code=404,
                detail="No account found with this number. Please sign up first."
            )
        try:
            import secrets as _secrets
            phone_digits = phone.lstrip("+")
            placeholder_email = f"sms_{phone_digits}@suqafuran.local"
            user = crud_user.create_user(
                db,
                email=placeholder_email,
                password=_secrets.token_hex(24),
                full_name=signup_data["full_name"],
                phone=phone,
            )
            user.phone_verified = True
            # Promote to tier1 after phone verification
            user.verified_level = UserVerifiedLevel.tier1

            promo_code_val = signup_data.get("promo_code")
            if promo_code_val:
                code_upper = promo_code_val.strip().upper()
                mc = db.exec(select(MarketingCode).where(MarketingCode.code == code_upper)).first()
                if mc and mc.is_active and (mc.max_uses is None or mc.uses_count < mc.max_uses):
                    user.referral_code = code_upper
                    mc.uses_count += 1
                    db.add(mc)

            db.add(user)
            db.add(AuditLog(
                user_id=user.id, action="USER_SIGNUP", resource_type="user",
                resource_id=user.id, details=f"Phone signup: {phone}"
            ))
            db.commit()
            db.refresh(user)
            link_signup_device(db, user, request)
            africastalking_service.delete_pending_signup(phone)

            # Publish signup event to Kafka (non-blocking)
            try:
                await publish_signup_event(
                    user_id=user.id,
                    email=user.email,
                    phone=user.phone,
                    promo_code=user.referral_code,
                )
            except Exception as e:
                logger.warning(f"Failed to publish signup event: {e}")

            USER_REGISTRATIONS_TOTAL.labels(method="phone_otp").inc()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Account creation failed. Please try again.")
    else:
        user.phone_verified = True
        db.add(user)
        db.add(AuditLog(
            user_id=user.id, action="USER_LOGIN", resource_type="user",
            resource_id=user.id, details=f"Phone OTP login: {phone}"
        ))
        db.commit()
        db.refresh(user)

        notify_if_new_device(db, user, request, background_tasks)

        # Publish signin event to Kafka (non-blocking)
        try:
            await publish_signin_event(
                user_id=user.id,
                email=user.email,
                auth_method="phone_otp",
                full_name=user.full_name,
            )
        except Exception as e:
            logger.warning(f"Failed to publish signin event: {e}")

        SUCCESSFUL_LOGINS_TOTAL.inc()

    access_token = security.create_session_token(db, user.id, request)
    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        max_age=settings.SESSION_TOKEN_DAYS * 86400,
        expires=settings.SESSION_TOKEN_DAYS * 86400,
        samesite="lax", secure=True,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.full_name, "email": user.email, "verified_level": user.verified_level}
    }


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    sid: Optional[str] = Depends(deps.get_current_session_id),
) -> Any:
    """End this device's session; its token stops working immediately."""
    if sid:
        security.revoke_sessions(db, current_user.id, session_id=sid)
    response.delete_cookie("access_token")
    return {"success": True}


@router.post("/logout-all")
def logout_all(
    response: Response,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Sign out on every device (e.g. after a lost phone)."""
    count = security.revoke_sessions(db, current_user.id)
    response.delete_cookie("access_token")
    return {"success": True, "sessions_ended": count}
