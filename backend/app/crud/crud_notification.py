from typing import List, Optional
from sqlmodel import Session, select
from app.models.notification import Notification

class CRUDNotification:
    def create(self, db: Session, *, obj_in: dict, user_id: int) -> Notification:
        db_obj = Notification(
            user_id=user_id,
            type=obj_in["type"],
            data=obj_in.get("data", {})
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_user_notifications(self, db: Session, *, user_id: int, limit: int = 20) -> List[Notification]:
        statement = select(Notification).where(
            Notification.user_id == user_id
        ).order_by(Notification.created_at.desc()).limit(limit)
        return db.exec(statement).all()

    def mark_as_read(self, db: Session, *, notification_id: int, user_id: int) -> Optional[Notification]:
        db_obj = db.get(Notification, notification_id)
        if db_obj and db_obj.user_id == user_id:
            db_obj.is_read = True
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            return db_obj
        return None

    def mark_all_as_read(self, db: Session, *, user_id: int) -> int:
        statement = select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
        notifications = db.exec(statement).all()
        for notif in notifications:
            notif.is_read = True
            db.add(notif)
        db.commit()
        return len(notifications)

    def remove(self, db: Session, *, notification_id: int, user_id: int) -> bool:
        db_obj = db.get(Notification, notification_id)
        if db_obj and db_obj.user_id == user_id:
            db.delete(db_obj)
            db.commit()
            return True
        return False

crud_notification = CRUDNotification()

