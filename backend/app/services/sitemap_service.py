"""Generates sitemap.xml -- static marketing/help pages plus every active
listing, verified shop, and category. Shared by the /seo/sitemap.xml
endpoint and scripts/generate_sitemap.py (which writes the static file
shops-app ships in its build, since the deployed site is a static SPA with
no server-side route to serve this dynamically at request time)."""

from datetime import datetime
from xml.sax.saxutils import escape
from sqlmodel import Session
from sqlalchemy import text

BASE_URL = "https://suqafuran.so"

# Slug generation must exactly match get_public_shops() in listings.py --
# shop slugs aren't a stored column, they're derived from the name the same
# way every time a shop is looked up.
def _shop_slug(shop_name: str, user_id) -> str:
    name = shop_name or f"Shop_{user_id}"
    slug = name.lower().strip().replace(" ", "").replace("_", "").replace("shop", "shop")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    return slug or f"shop_{user_id}"


STATIC_PAGES = [
    ("/", "daily", "1.0"),
    ("/shops", "daily", "0.9"),
    ("/search", "daily", "0.8"),
    ("/help-center", "monthly", "0.5"),
    ("/safe-trading-tips", "monthly", "0.5"),
    ("/terms-of-use", "yearly", "0.3"),
]


def _url_entry(loc: str, lastmod: str | None = None, changefreq: str | None = None, priority: str | None = None) -> str:
    parts = [f"  <url>\n    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    if changefreq:
        parts.append(f"    <changefreq>{changefreq}</changefreq>")
    if priority:
        parts.append(f"    <priority>{priority}</priority>")
    parts.append("  </url>")
    return "\n".join(parts)


def generate_sitemap_xml(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    entries: list[str] = []

    for path, changefreq, priority in STATIC_PAGES:
        entries.append(_url_entry(f"{BASE_URL}{path}", today, changefreq, priority))

    categories = db.execute(text("SELECT slug FROM category")).fetchall()
    for (slug,) in categories:
        entries.append(_url_entry(f"{BASE_URL}/{slug}", today, "daily", "0.7"))

    shops = db.execute(text("""
        SELECT u.id, COALESCE(u.business_name, u.full_name) as shop_name
        FROM "user" u
        INNER JOIN listing l ON l.owner_id = u.id AND l.status = 'active'
        WHERE u.is_verified = true
        GROUP BY u.id, u.business_name, u.full_name
    """)).fetchall()
    for user_id, shop_name in shops:
        slug = _shop_slug(shop_name, user_id)
        entries.append(_url_entry(f"{BASE_URL}/shop/{slug}", today, "daily", "0.6"))

    listings = db.execute(text("""
        SELECT id, updated_at FROM listing WHERE status = 'active'
    """)).fetchall()
    for listing_id, updated_at in listings:
        lastmod = updated_at.strftime("%Y-%m-%d") if updated_at else today
        entries.append(_url_entry(f"{BASE_URL}/listing/{listing_id}", lastmod, "weekly", "0.6"))

    body = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n"
    )
