#!/usr/bin/env python3
"""
Regenerate sitemap.xml from live data and write it straight into shops-app's
public/ folder, ready to be picked up by the next `npm run build`.

The deployed site is a static SPA on shared hosting -- there's no
server-side route to serve a dynamic sitemap at request time, so this needs
to be a real file baked into each deploy. Run this before building/zipping
shops-app for upload, ideally as close to deploy time as possible so listing
data is current.

Usage:
    python scripts/generate_sitemap.py
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.services.sitemap_service import generate_sitemap_xml  # noqa: E402

OUTPUT_PATH = BACKEND_ROOT.parent / "shops-app" / "public" / "sitemap.xml"


def main():
    db = SessionLocal()
    try:
        xml = generate_sitemap_xml(db)
    finally:
        db.close()

    OUTPUT_PATH.write_text(xml)
    url_count = xml.count("<url>")
    print(f"Wrote {url_count} URLs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
