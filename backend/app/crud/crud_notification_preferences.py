from sqlmodel import Session, select
from app.models.notification_preferences import NotificationPreferences


class CRUDNotificationPreferences:
    def get_or_create(self, db: Session, user_id: int):
        prefs = db.exec(
            select(NotificationPreferences).where(NotificationPreferences.user_id == user_id)
        ).first()

        if not prefs:
            prefs = NotificationPreferences(user_id=user_id)
            db.add(prefs)
            db.commit()
            db.refresh(prefs)

        return prefs

    def get(self, db: Session, user_id: int):
        return db.exec(
            select(NotificationPreferences).where(NotificationPreferences.user_id == user_id)
        ).first()

    def update(self, db: Session, db_obj: NotificationPreferences, obj_in: dict):
        for key, value in obj_in.items():
            setattr(db_obj, key, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


crud_notification_preferences = CRUDNotificationPreferences()
