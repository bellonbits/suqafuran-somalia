"""
Patch name_so for all categories, subcategories, and sub-subcategories
that currently have name_so = NULL.

Reads translations from categories_so.json (English name -> Somali name).
Safe to run multiple times — only updates rows where name_so is missing.

Usage (inside Docker):
    docker exec suqafuran_api python patch_name_so.py
"""
import json
import os
from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Category, SubCategory, SubSubCategory

# ── Load translation map ────────────────────────────────────────────────────
_here = os.path.dirname(os.path.abspath(__file__))
_map_path = os.path.join(_here, "categories_so.json")

with open(_map_path, encoding="utf-8") as f:
    SO: dict[str, str] = json.load(f)

def so(name_en: str) -> str | None:
    """Return Somali translation or None if not found."""
    return SO.get(name_en) or None


def patch():
    updated = 0
    skipped = 0

    with Session(engine) as session:
        # ── Root categories ─────────────────────────────────────────────────
        cats = session.exec(select(Category)).all()
        for cat in cats:
            translation = so(cat.name_en)
            if not cat.name_so and translation:
                cat.name_so = translation
                session.add(cat)
                updated += 1
                print(f"  CAT  {cat.name_en!r} → {translation!r}")
            else:
                skipped += 1

        # ── Subcategories ───────────────────────────────────────────────────
        subs = session.exec(select(SubCategory)).all()
        for sub in subs:
            translation = so(sub.name_en)
            if not sub.name_so and translation:
                sub.name_so = translation
                session.add(sub)
                updated += 1
                print(f"  SUB  {sub.name_en!r} → {translation!r}")
            else:
                skipped += 1

        # ── Sub-subcategories ───────────────────────────────────────────────
        ssubs = session.exec(select(SubSubCategory)).all()
        for ss in ssubs:
            translation = so(ss.name_en)
            if not ss.name_so and translation:
                ss.name_so = translation
                session.add(ss)
                updated += 1
                print(f"  SSUB {ss.name_en!r} → {translation!r}")
            else:
                skipped += 1

        session.commit()

    print(f"\nDone. Updated: {updated}  |  Already set / no translation: {skipped}")


if __name__ == "__main__":
    patch()
