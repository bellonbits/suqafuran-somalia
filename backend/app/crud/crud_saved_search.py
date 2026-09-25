from sqlmodel import Session, select
from app.models.saved_search import SavedSearch


class CRUDSavedSearch:
    def create(self, db: Session, *, obj_in: dict, user_id: int) -> SavedSearch:
        db_obj = SavedSearch(
            user_id=user_id,
            name=obj_in["name"],
            query=obj_in["query"],
            category_id=obj_in.get("category_id"),
            min_price=obj_in.get("min_price"),
            max_price=obj_in.get("max_price"),
            location=obj_in.get("location"),
            is_active=True
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get(self, db: Session, id: int):
        return db.get(SavedSearch, id)

    def get_by_user(self, db: Session, user_id: int):
        return db.exec(
            select(SavedSearch).where(SavedSearch.user_id == user_id, SavedSearch.is_active == True)
        ).all()

    def get_active(self, db: Session):
        return db.exec(select(SavedSearch).where(SavedSearch.is_active == True)).all()

    def update(self, db: Session, db_obj: SavedSearch, obj_in: dict):
        for key, value in obj_in.items():
            setattr(db_obj, key, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int):
        obj = db.get(SavedSearch, id)
        if obj:
            db.delete(obj)
            db.commit()


crud_saved_search = CRUDSavedSearch()
