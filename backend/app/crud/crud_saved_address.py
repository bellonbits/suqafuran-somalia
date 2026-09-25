from typing import List, Optional
from sqlmodel import Session, select
from app.models.saved_address import SavedAddress


class CRUDSavedAddress:
    def create(self, db: Session, *, user_id: int, label: str, formatted_address: str,
               lat: Optional[float] = None, lng: Optional[float] = None, is_default: bool = False) -> SavedAddress:
        if is_default:
            self._clear_default(db, user_id=user_id)

        db_obj = SavedAddress(
            user_id=user_id,
            label=label,
            formatted_address=formatted_address,
            lat=lat,
            lng=lng,
            is_default=is_default,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_user_addresses(self, db: Session, *, user_id: int) -> List[SavedAddress]:
        statement = select(SavedAddress).where(
            SavedAddress.user_id == user_id
        ).order_by(SavedAddress.is_default.desc(), SavedAddress.created_at.desc())
        return db.exec(statement).all()

    def update(self, db: Session, *, address_id: int, user_id: int, updates: dict) -> Optional[SavedAddress]:
        db_obj = db.get(SavedAddress, address_id)
        if not db_obj or db_obj.user_id != user_id:
            return None

        if updates.get("is_default"):
            self._clear_default(db, user_id=user_id)

        for field in ("label", "is_default"):
            if field in updates and updates[field] is not None:
                setattr(db_obj, field, updates[field])

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, address_id: int, user_id: int) -> bool:
        db_obj = db.get(SavedAddress, address_id)
        if db_obj and db_obj.user_id == user_id:
            db.delete(db_obj)
            db.commit()
            return True
        return False

    def _clear_default(self, db: Session, *, user_id: int) -> None:
        statement = select(SavedAddress).where(
            SavedAddress.user_id == user_id,
            SavedAddress.is_default == True
        )
        for addr in db.exec(statement).all():
            addr.is_default = False
            db.add(addr)
        db.commit()


crud_saved_address = CRUDSavedAddress()
