"""
Force-patch name_so for ALL categories, subcategories, and sub-subcategories
using the translations in categories_so.json.

Unlike patch_name_so.py (which only fills NULL rows), this script overwrites
every existing name_so — use it after correcting translations in the JSON.

Usage (inside Docker):
    docker exec suqafuran_api python patch_name_so_force.py
"""
import json
import os
from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Category, SubCategory, SubSubCategory

_here = os.path.dirname(os.path.abspath(__file__))
_map_path = os.path.join(_here, "categories_so.json")

with open(_map_path, encoding="utf-8") as f:
    SO: dict[str, str] = json.load(f)


def so(name_en: str) -> str | None:
    return SO.get(name_en) or None


def patch():
    updated = 0
    skipped = 0

    with Session(engine) as session:
        # Root categories
        for cat in session.exec(select(Category)).all():
            translation = so(cat.name_en)
            if translation:
                if cat.name_so != translation:
                    print(f"  CAT  {cat.name_en!r}: {cat.name_so!r} → {translation!r}")
                    cat.name_so = translation
                    session.add(cat)
                    updated += 1
                else:
                    skipped += 1
            else:
                print(f"  CAT  MISSING TRANSLATION: {cat.name_en!r}")
                skipped += 1

        # Subcategories
        for sub in session.exec(select(SubCategory)).all():
            translation = so(sub.name_en)
            if translation:
                if sub.name_so != translation:
                    print(f"  SUB  {sub.name_en!r}: {sub.name_so!r} → {translation!r}")
                    sub.name_so = translation
                    session.add(sub)
                    updated += 1
                else:
                    skipped += 1
            else:
                print(f"  SUB  MISSING TRANSLATION: {sub.name_en!r}")
                skipped += 1

        # Sub-subcategories
        for ss in session.exec(select(SubSubCategory)).all():
            translation = so(ss.name_en)
            if translation:
                if ss.name_so != translation:
                    print(f"  SSUB {ss.name_en!r}: {ss.name_so!r} → {translation!r}")
                    ss.name_so = translation
                    session.add(ss)
                    updated += 1
                else:
                    skipped += 1
            else:
                print(f"  SSUB MISSING TRANSLATION: {ss.name_en!r}")
                skipped += 1

        session.commit()

    print(f"\nDone. Updated: {updated}  |  Unchanged / no translation: {skipped}")


if __name__ == "__main__":
    patch()
