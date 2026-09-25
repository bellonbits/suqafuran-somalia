from sqlmodel import Session, select
from app.models.offer import Offer


class CRUDOffer:
    def create(self, db: Session, *, obj_in: dict, buyer_id: int) -> Offer:
        db_obj = Offer(
            listing_id=obj_in["listing_id"],
            buyer_id=buyer_id,
            amount=obj_in["amount"],
            message=obj_in.get("message")
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get(self, db: Session, id: int):
        return db.get(Offer, id)

    def get_by_listing(self, db: Session, listing_id: int):
        return db.exec(select(Offer).where(Offer.listing_id == listing_id)).all()

    def get_by_buyer(self, db: Session, buyer_id: int):
        return db.exec(select(Offer).where(Offer.buyer_id == buyer_id)).all()

    def get_active(self, db: Session, listing_id: int):
        return db.exec(
            select(Offer).where(
                Offer.listing_id == listing_id,
                Offer.status == "pending"
            )
        ).all()

    def update(self, db: Session, db_obj: Offer, obj_in: dict):
        for key, value in obj_in.items():
            setattr(db_obj, key, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int):
        obj = db.get(Offer, id)
        if obj:
            db.delete(obj)
            db.commit()


crud_offer = CRUDOffer()
