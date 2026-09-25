"""
Add missing subcategories to the "Mobile Phones & Tablets" category
and ensure all name_so fields are populated.

Safe to run multiple times.

Usage (inside Docker):
    docker exec suqafuran_api python patch_phones_subcategories.py
"""
import json
from sqlmodel import Session, select
from app.db.session import engine
from app.models.listing import Category, SubCategory

NEW_SUBCATEGORIES = [
    {
        "name_en": "Tablets",
        "name_so": "Tableedyada",
        "slug": "tablets",
    },
    {
        "name_en": "Phone Accessories",
        "name_so": "Qalabka Taleefanka",
        "slug": "phone-accessories",
    },
    {
        "name_en": "Smart Watches",
        "name_so": "Saacadaha Casriga ah",
        "slug": "smart-watches",
    },
]

# Fix name_so for existing subcategories whose slug may vary
EXISTING_NAME_EN_FIXES = {
    "Mobile Phones": "Taleefammada Gacanta",
}


def find_phones_category(session: Session) -> Category | None:
    """Find the Phones category by trying multiple slugs and name_en patterns."""
    slugs_to_try = [
        "mobile-phones-tablets",
        "mobile-phones",
        "phones",
        "phones-tablets",
    ]
    for slug in slugs_to_try:
        cat = session.exec(select(Category).where(Category.slug == slug)).first()
        if cat:
            return cat

    # Fallback: search by name_en containing "Phone"
    all_cats = session.exec(select(Category)).all()
    for cat in all_cats:
        name = (cat.name_en or "").lower()
        if "phone" in name or "mobile" in name:
            return cat

    return None


def patch():
    with Session(engine) as session:
        # List all categories so user can debug if needed
        all_cats = session.exec(select(Category)).all()
        print("All categories in DB:")
        for c in all_cats:
            print(f"  slug={c.slug!r}  name_en={getattr(c, 'name_en', None)!r}")

        cat = find_phones_category(session)

        if not cat:
            print("\nERROR: Could not find a Mobile Phones category. Aborting.")
            return

        print(f"\nUsing category: slug={cat.slug!r}  name_en={getattr(cat, 'name_en', None)!r}  id={cat.id}")

        # Fix name_so on root category if missing
        if not cat.name_so:
            cat.name_so = "Taleefammada & Tableedyada"
            session.add(cat)
            print(f"  Fixed root category name_so → {cat.name_so!r}")

        # Get existing subcategories
        existing_subs = session.exec(
            select(SubCategory).where(SubCategory.category_id == cat.id)
        ).all()

        for sub in existing_subs:
            fix_so = EXISTING_NAME_EN_FIXES.get(getattr(sub, "name_en", "") or "")
            if fix_so and not sub.name_so:
                sub.name_so = fix_so
                session.add(sub)
                print(f"  Fixed existing sub {sub.name_en!r} name_so → {fix_so!r}")

        existing_slugs = {sub.slug for sub in existing_subs}

        # Add new subcategories
        for sub_data in NEW_SUBCATEGORIES:
            if sub_data["slug"] in existing_slugs:
                print(f"  SKIP (already exists): {sub_data['name_en']!r}")
                continue

            new_sub = SubCategory(
                name_en=sub_data["name_en"],
                name_so=sub_data["name_so"],
                slug=sub_data["slug"],
                category_id=cat.id,
                attributes_schema=json.dumps({}),
            )
            session.add(new_sub)
            print(f"  ADDED: {sub_data['name_en']!r} / {sub_data['name_so']!r}")

        session.commit()
        print("\nDone.")


if __name__ == "__main__":
    patch()
