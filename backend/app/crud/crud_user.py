from datetime import datetime
from typing import Optional
from sqlmodel import Session, select, func
from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserCreate, UserUpdate


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    cleaned = "".join(c for c in phone if c.isdigit() or c == '+')
    return cleaned if cleaned else None


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    if not email:
        return None
    statement = select(User).where(User.email == email.strip().lower())
    return db.exec(statement).first()


def get_user_by_phone(db: Session, phone: str, exclude_user_id: Optional[int] = None) -> Optional[User]:
    if not phone:
        return None
    cleaned = normalize_phone(phone)
    statement = select(User).where((User.phone == phone) | (User.phone == cleaned))
    if exclude_user_id:
        statement = statement.where(User.id != exclude_user_id)
    return db.exec(statement).first()


def get_user_by_business_name(db: Session, business_name: str, exclude_user_id: Optional[int] = None) -> Optional[User]:
    if not business_name or not business_name.strip():
        return None
    statement = select(User).where(func.lower(User.business_name) == business_name.strip().lower())
    if exclude_user_id:
        statement = statement.where(User.id != exclude_user_id)
    return db.exec(statement).first()


def create_user(db: Session, email: str, password: str, full_name: Optional[str] = None, phone: Optional[str] = None) -> User:
    cleaned_phone = normalize_phone(phone) if phone else None
    db_obj = User(
        email=email.strip().lower(),
        phone=cleaned_phone or phone,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        is_active=True,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def authenticate(
    db: Session, email: str, password: str
) -> Optional[User]:
    user = get_user_by_email(db, email=email)
    if not user:
        return None
    if not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def update_user(db: Session, db_obj: User, user_in: UserUpdate) -> User:
    update_data = user_in.model_dump(exclude_unset=True)

    if "phone" in update_data and update_data["phone"]:
        cleaned_phone = normalize_phone(update_data["phone"])
        existing_phone = get_user_by_phone(db, phone=update_data["phone"], exclude_user_id=db_obj.id)
        if existing_phone:
            raise ValueError("PHONE_ALREADY_EXISTS")
        update_data["phone"] = cleaned_phone or update_data["phone"]

    if "email" in update_data and update_data["email"]:
        existing_email = get_user_by_email(db, email=update_data["email"])
        if existing_email and existing_email.id != db_obj.id:
            raise ValueError("EMAIL_ALREADY_EXISTS")
        update_data["email"] = update_data["email"].strip().lower()

    if "business_name" in update_data and update_data["business_name"]:
        existing_biz = get_user_by_business_name(db, business_name=update_data["business_name"], exclude_user_id=db_obj.id)
        if existing_biz:
            raise ValueError("BUSINESS_NAME_ALREADY_EXISTS")

    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data["password"])
        del update_data["password"]
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db_obj.updated_at = datetime.utcnow()
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def verify_user(db: Session, db_obj: User) -> User:
    db_obj.is_verified = True
    db_obj.updated_at = datetime.utcnow()
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def create_social_user(db: Session, email: str, full_name: str, provider: str) -> User:
    # Use a dummy password for social users
    import uuid
    dummy_password = str(uuid.uuid4())
    db_obj = User(
        full_name=full_name,
        email=email.strip().lower(),
        hashed_password=get_password_hash(dummy_password),
        is_active=True,
        is_verified=False, # Verify them? Usually social is trusted.
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
