from sqlmodel import Session, select
from app.models.price_alert import PriceAlert


class CRUDPriceAlert:
    def create(self, db: Session, *, obj_in: dict, user_id: int) -> PriceAlert:
        db_obj = PriceAlert(
            listing_id=obj_in["listing_id"],
            user_id=user_id,
            target_price=obj_in.get("target_price"),
            is_active=True
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_user(self, db: Session, user_id: int):
        return db.exec(
            select(PriceAlert).where(PriceAlert.user_id == user_id, PriceAlert.is_active == True)
        ).all()

    def get_by_listing(self, db: Session, listing_id: int):
        return db.exec(
            select(PriceAlert).where(PriceAlert.listing_id == listing_id, PriceAlert.is_active == True)
        ).all()

    def get_watched(self, db: Session, user_id: int, listing_id: int):
        return db.exec(
            select(PriceAlert).where(
                PriceAlert.user_id == user_id,
                PriceAlert.listing_id == listing_id,
                PriceAlert.is_active == True
            )
        ).first()

    def update(self, db: Session, db_obj: PriceAlert, obj_in: dict):
        for key, value in obj_in.items():
            setattr(db_obj, key, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


crud_price_alert = CRUDPriceAlert()
