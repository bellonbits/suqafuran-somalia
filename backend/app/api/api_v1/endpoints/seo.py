from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session, select, or_, col
from app.api import deps
from app.models.listing import Listing
from app.services.sitemap_service import generate_sitemap_xml

router = APIRouter()


@router.get("/sitemap.xml")
def get_sitemap(db: Session = Depends(deps.get_db)) -> Response:
    """
    Live sitemap covering static pages, categories, verified shops and
    active listings. The deployed site is a static SPA on shared hosting
    with no server-side routing, so this isn't what search engines actually
    fetch at suqafuran.com/sitemap.xml -- see scripts/generate_sitemap.py,
    which calls the same generator to produce the static file shipped in
    each shops-app build. This endpoint exists for on-demand checks/testing.
    """
    return Response(content=generate_sitemap_xml(db), media_type="application/xml")


@router.get("/landing")
def get_seo_landing(
    product: Optional[str] = Query(None, description="Product search keyword, e.g. iPhone 15"),
    city: Optional[str] = Query(None, description="City location, e.g. Nairobi"),
    category: Optional[str] = Query(None, description="Category name, e.g. Electronics"),
    country: Optional[str] = Query(None, description="Country name, e.g. Kenya"),
    skill: Optional[str] = Query(None, description="Freelancer skill, e.g. web developer"),
    service: Optional[str] = Query(None, description="Service type, e.g. plumber"),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Programmatic SEO landing page metadata and real listings generator.
    Produces highly tailored dynamic content, SEO paragraphs, Schema.org markup, and listings.
    """
    # 1. Clean and normalize inputs
    p_clean = product.strip() if product else ""
    c_clean = city.strip() if city else "Kenya"
    cat_clean = category.strip() if category else "Products"
    country_clean = country.strip() if country else "Africa"
    skill_clean = skill.strip() if skill else ""
    srv_clean = service.strip() if service else ""

    # Determine dominant query type
    subject = "Items"
    if p_clean:
        subject = p_clean
    elif skill_clean:
        subject = f"{skill_clean} services"
    elif srv_clean:
        subject = f"{srv_clean} services"
    elif cat_clean != "Products":
        subject = cat_clean

    # Determine location text
    location_text = c_clean
    if country_clean and country_clean != "Africa" and country_clean != c_clean:
        location_text = f"{c_clean}, {country_clean}"

    # 2. Query Live Listings Matching the Criteria
    query = select(Listing).where(Listing.status == "active")
    
    # Filter by product/subject if provided
    if p_clean:
        query = query.where(
            or_(
                col(Listing.title_en).ilike(f"%{p_clean}%"),
                col(Listing.title_so).ilike(f"%{p_clean}%"),
                col(Listing.description_en).ilike(f"%{p_clean}%")
            )
        )
    elif skill_clean:
        query = query.where(
            or_(
                col(Listing.title_en).ilike(f"%{skill_clean}%"),
                col(Listing.description_en).ilike(f"%{skill_clean}%")
            )
        )
    elif srv_clean:
        query = query.where(
            or_(
                col(Listing.title_en).ilike(f"%{srv_clean}%"),
                col(Listing.description_en).ilike(f"%{srv_clean}%")
            )
        )
    elif cat_clean != "Products":
        query = query.where(col(Listing.category_en).ilike(f"%{cat_clean}%"))

    # Filter by location
    if city:
        query = query.where(col(Listing.location).ilike(f"%{city}%"))

    # Fetch top 8 live ads
    listings = db.exec(query.limit(8)).all()

    # 3. Dynamic Price and Count Stats for Product Schema
    prices = [l.price for l in listings if l.price]
    low_price = min(prices) if prices else 10
    high_price = max(prices) if prices else 1000
    offer_count = len(listings) if listings else 5

    # 4. Generate SEO Content Block dynamically
    title = f"Cheap {subject} in {location_text} | Buy & Sell on Suqafuran"
    meta_desc = f"Looking for the best price on {subject} in {location_text}? Check out verified local listings on Suqafuran. Save with discount offers directly from trusted sellers."
    h1 = f"Genuine {subject} for Sale in {location_text}"
    
    seo_desc = (
        f"Welcome to Suqafuran, the leading localized marketplace in {location_text}. "
        f"Browse the absolute best deals, genuine original products, and premium verified offers for "
        f"{subject} nearby. Our advanced anti-scam protection, seller verification checks, "
        f"and buyer safety guarantees ensure you can shop with total confidence. Connect directly "
        f"with trusted local dealers, bargain the best price, and secure same-day delivery or safe meet-up options today!"
    )

    # 5. Schema.org JSON-LD structures
    faq_schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f"Where is the best place to buy {subject} in {location_text}?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"The best place to buy genuine and cheap {subject} in {location_text} is on Suqafuran. You can interact directly with verified local sellers and view real-time photo listings."
                }
            },
            {
                "@type": "Question",
                "name": f"How does Suqafuran ensure safety for transactions in {location_text}?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"Suqafuran offers comprehensive anti-scam listing checks, verified badges for trusted merchants, and guidelines for secure in-person cash-on-delivery meet-ups."
                }
            }
        ]
    }

    breadcrumbs = [
        {"name": "Home", "url": "/"},
        {"name": location_text, "url": f"/search?location={encode_query(c_clean)}"},
        {"name": cat_clean, "url": f"/search?category={encode_query(cat_clean)}"}
    ]
    if p_clean:
        breadcrumbs.append({"name": p_clean, "url": f"/seo?product={encode_query(p_clean)}&city={encode_query(c_clean)}"})

    schema_markup = {
        "@context": "https://schema.org",
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": str(low_price),
        "highPrice": str(high_price),
        "offerCount": str(offer_count),
    }

    return {
        "title": title,
        "meta_description": meta_desc,
        "h1": h1,
        "seo_description": seo_desc,
        "breadcrumbs": breadcrumbs,
        "faq_schema": faq_schema,
        "schema_markup": schema_markup,
        "listings": listings
    }

def encode_query(val: str) -> str:
    import urllib.parse
    return urllib.parse.quote(val)
