from typing import List
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from app.models.favorite import Favorite
from app.models.listing import Listing

class CRUDFavorite:
    def create(self, db: Session, *, user_id: int, listing_id: int) -> Favorite:
        db_obj = Favorite(user_id=user_id, listing_id=listing_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, user_id: int, listing_id: int) -> None:
        statement = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.listing_id == listing_id
        )
        obj = db.exec(statement).first()
        if obj:
            db.delete(obj)
            db.commit()

    def get_user_favorites(self, db: Session, *, user_id: int) -> List[Listing]:
        statement = (
            select(Listing)
            .join(Favorite)
            .where(Favorite.user_id == user_id)
            .options(selectinload(Listing.owner))
        )
        return db.exec(statement).all()

    def is_favorite(self, db: Session, *, user_id: int, listing_id: int) -> bool:
        statement = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.listing_id == listing_id
        )
        return db.exec(statement).first() is not None

crud_favorite = CRUDFavorite()
