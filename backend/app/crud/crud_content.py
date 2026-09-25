from typing import List, Optional
from sqlmodel import Session, select
from app.models.site_content import SiteContent, SiteContentUpdate


def get_site_content(db: Session) -> List[SiteContent]:
    return db.exec(select(SiteContent)).all()


def get_content_by_key(db: Session, key: str) -> Optional[SiteContent]:
    return db.exec(select(SiteContent).where(SiteContent.key == key)).first()


def create_site_content(db: Session, *, content_in: SiteContent) -> SiteContent:
    db.add(content_in)
    db.commit()
    db.refresh(content_in)
    return content_in


def update_site_content(
    db: Session, *, db_obj: SiteContent, content_in: SiteContentUpdate
) -> SiteContent:
    update_data = content_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def remove_site_content(db: Session, *, id: int) -> SiteContent:
    obj = db.get(SiteContent, id)
    db.delete(obj)
    db.commit()
    return obj
