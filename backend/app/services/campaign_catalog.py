"""Registry of promotional/lifecycle campaign definitions for the rotation
engine (app/services/rotation_engine.py). Each entry owns its own targeting
(eligibility_fn), content selection (content_selector_fn), and knows how to
actually send itself (send_fn) -- the engine only handles which campaigns a
user is due for and in what order, never the campaign-specific logic.

Two kinds of campaigns live here:
  - "promo_*": genuinely promotional, subject to EmailPreference.promotional_emails
    and the weekly promotional frequency cap.
  - everything else: lifecycle/utility sends (digest, reengagement, saved-search
    matches) gated by their own EmailPreference field instead, and not counted
    against the promotional cap.

The lifecycle campaigns port the query logic that used to live in the
now-deleted app/services/marketing_tasks.py (that file was written but never
scheduled, and had real bugs -- wrong field names, a bad inactivity proxy --
fixed here rather than carried forward).
"""

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from sqlmodel import Session, select, func

from app.models.user import User
from app.models.listing import Listing, Category
from app.models.marketing import UserBrowsingHistory, SavedSearch
from app.services.email_service import email_service


@dataclass
class CampaignDefinition:
    campaign_type: str
    subject_variants: List[str]
    cooldown_days: int
    is_promotional: bool
    eligibility_fn: Callable[[Session, User], bool]
    # Returns None if there's nothing worth sending right now (e.g. no listings).
    content_selector_fn: Callable[[Session, User], Optional[Dict[str, Any]]]
    # (email, name, subject, content) -> bool. `content` is whatever
    # content_selector_fn returned, minus the bookkeeping keys the engine
    # already consumed (listing_ids/category_id/shop_ids).
    send_fn: Callable[[str, str, str, Dict[str, Any]], bool]


# ---------------------------------------------------------------------------
# Shared helpers

def _active_listing_query():
    return select(Listing).where(Listing.status == "active", Listing.moderation_status == "approved")


def _listing_to_item(listing: Listing) -> dict:
    return {
        "title": listing.title_en,
        "price": f"{listing.price:,.0f}",
        "id": listing.id,
        "location": listing.location,
        "image_url": (listing.images or [None])[0],
    }


def _has_active_listings(db: Session, min_count: int = 3) -> bool:
    count = db.exec(select(func.count()).select_from(_active_listing_query().subquery())).one()
    return count >= min_count


def _sample(pool: list, k: int) -> list:
    """Randomly picks up to k items from a pool pulled wider than what's
    actually sent, so repeat sends (the cooldown windows here run from 3 to
    21 days) don't keep showing the exact same deterministic top-N -- this
    was the actual cause of emails always featuring the same products/shop:
    every selector below used to be a plain ORDER BY ... LIMIT N with no
    randomization, so the same top-ranked rows won every single time."""
    if len(pool) <= k:
        return pool
    return random.sample(pool, k)


# ---------------------------------------------------------------------------
# Promotional: new arrivals

def _new_arrivals_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    pool = db.exec(_active_listing_query().order_by(Listing.created_at.desc()).limit(24)).all()
    if not pool:
        return None
    listings = _sample(pool, 6)
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": None,
        "shop_ids": [],
        "location": user.location or "your area",
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_new_arrivals(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_trending_items_email(email, name, content["location"], content["items"])


# ---------------------------------------------------------------------------
# Promotional: category spotlight (based on the user's own browsing history)

def _most_viewed_category_id(db: Session, user_id: int, days: int = 30) -> Optional[int]:
    since = datetime.utcnow() - timedelta(days=days)
    row = db.exec(
        select(UserBrowsingHistory.category_id, func.count().label("c"))
        .where(UserBrowsingHistory.user_id == user_id, UserBrowsingHistory.viewed_at >= since,
               UserBrowsingHistory.category_id.isnot(None))
        .group_by(UserBrowsingHistory.category_id)
        .order_by(func.count().desc())
        .limit(1)
    ).first()
    return row[0] if row else None


def _category_spotlight_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    category_id = _most_viewed_category_id(db, user.id)
    if not category_id:
        return None
    category = db.get(Category, category_id)
    if not category:
        return None
    pool = db.exec(
        _active_listing_query().where(Listing.category_id == category_id)
        .order_by(Listing.created_at.desc()).limit(16)
    ).all()
    if not pool:
        return None
    listings = _sample(pool, 4)
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": category_id,
        "shop_ids": [],
        "category_name": category.name_en,
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_category_spotlight(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_category_interest_email(email, name, content["category_name"], content["items"])


# ---------------------------------------------------------------------------
# Promotional: trending (most-viewed live listings, marketplace-wide)

def _trending_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    # Views only ever grow, so a plain top-N-by-views is a fixed leaderboard
    # that never changes order -- pull a wider "currently popular" pool and
    # rotate which of them actually get featured on each send.
    pool = db.exec(_active_listing_query().order_by(Listing.views.desc()).limit(24)).all()
    if not pool:
        return None
    listings = _sample(pool, 6)
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": None,
        "shop_ids": [],
        "location": user.location or "your area",
        "items": [_listing_to_item(l) for l in listings],
    }


# ---------------------------------------------------------------------------
# Promotional: shop spotlight (a seller with several active listings)

def _shop_spotlight_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    # Every qualifying shop (>=3 active listings), not just the single
    # biggest one -- picking a random one each send is why this campaign
    # used to feature the same top seller on every send, for every user.
    rows = db.exec(
        select(Listing.owner_id)
        .where(Listing.status == "active", Listing.moderation_status == "approved", Listing.owner_id != user.id)
        .group_by(Listing.owner_id)
        .having(func.count() >= 3)
    ).all()
    if not rows:
        return None
    shop_owner_id = random.choice(rows)
    seller = db.get(User, shop_owner_id)
    if not seller:
        return None
    listings = db.exec(
        _active_listing_query().where(Listing.owner_id == shop_owner_id)
        .order_by(Listing.created_at.desc()).limit(4)
    ).all()
    if not listings:
        return None
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": None,
        "shop_ids": [shop_owner_id],
        "category_name": f"{seller.full_name or 'This seller'}'s shop",
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_shop_spotlight(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_category_interest_email(email, name, content["category_name"], content["items"])


def _send_trending(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_trending_items_email(email, name, content["location"], content["items"])


# ---------------------------------------------------------------------------
# Promotional: personalized recommendations (mix of the user's top categories)

def _personalized_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    since = datetime.utcnow() - timedelta(days=30)
    category_ids = db.exec(
        select(UserBrowsingHistory.category_id)
        .where(UserBrowsingHistory.user_id == user.id, UserBrowsingHistory.viewed_at >= since,
               UserBrowsingHistory.category_id.isnot(None))
        .group_by(UserBrowsingHistory.category_id)
        .order_by(func.count().desc())
        .limit(3)
    ).all()
    if not category_ids:
        return None
    pool = db.exec(
        _active_listing_query().where(Listing.category_id.in_(category_ids))
        .order_by(Listing.created_at.desc()).limit(20)
    ).all()
    if not pool:
        return None
    listings = _sample(pool, 6)
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": category_ids[0],
        "shop_ids": [],
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_personalized(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_recommended_items_email(email, name, content["items"])


# ---------------------------------------------------------------------------
# Promotional: new shops (sellers who posted their first listing recently)

def _new_shops_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    since = datetime.utcnow() - timedelta(days=14)
    # All new shops in the window, not just whichever one the DB happens to
    # return first with no ORDER BY -- that was pinning this campaign to
    # the same "new shop" on every send until it aged out of the 14-day
    # window entirely.
    rows = db.exec(
        select(Listing.owner_id).where(
            Listing.status == "active", Listing.moderation_status == "approved",
            Listing.created_at >= since, Listing.owner_id != user.id,
        ).group_by(Listing.owner_id)
    ).all()
    if not rows:
        return None
    shop_owner_id = random.choice(rows)
    seller = db.get(User, shop_owner_id)
    listings = db.exec(
        _active_listing_query().where(Listing.owner_id == shop_owner_id)
        .order_by(Listing.created_at.desc()).limit(4)
    ).all()
    if not seller or not listings:
        return None
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": None,
        "shop_ids": [shop_owner_id],
        "category_name": f"{seller.full_name or 'A new seller'}'s new shop",
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_new_shops(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_category_interest_email(email, name, content["category_name"], content["items"])


# ---------------------------------------------------------------------------
# Lifecycle: weekly digest (ported from the dead marketing_tasks.py, unchanged
# logic shape -- pick recent listings + top categories for this user's area)

def _weekly_digest_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    pool = db.exec(
        _active_listing_query().order_by(Listing.created_at.desc()).limit(20)
    ).all()
    if not pool:
        return None
    listings = _sample(pool, 5)
    top_categories = db.exec(
        select(Category.name_en).join(Listing, Listing.category_id == Category.id)
        .where(Listing.status == "active").group_by(Category.name_en)
        .order_by(func.count().desc()).limit(3)
    ).all()
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": None,
        "shop_ids": [],
        "location": user.location or "your area",
        "items": [_listing_to_item(l) for l in listings],
        "categories": [{"name": c} for c in top_categories] or [{"name": "Marketplace"}],
    }


def _send_weekly_digest(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_weekly_digest(email, name, content["location"], content["items"], content["categories"])


# ---------------------------------------------------------------------------
# Lifecycle: re-engagement for sellers who've gone quiet. There's no
# last_login field on User today, so "inactive" is approximated from the
# newest of their own listing/message activity rather than a true login
# timestamp -- documented limitation, not a precise signal.

def _reengagement_eligible(db: Session, user: User) -> bool:
    if not user.is_active:
        return False
    has_listing = db.exec(select(Listing.id).where(Listing.owner_id == user.id).limit(1)).first()
    if not has_listing:
        return False  # only targets people who've actually used the platform before
    recent_activity = db.exec(
        select(Listing.id).where(
            Listing.owner_id == user.id, Listing.created_at >= datetime.utcnow() - timedelta(days=14)
        ).limit(1)
    ).first()
    return recent_activity is None


def _reengagement_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    pool = db.exec(_active_listing_query().order_by(Listing.views.desc()).limit(12)).all()
    if not pool:
        return None
    listings = _sample(pool, 2)
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": None,
        "shop_ids": [],
        "reason": "we've missed you",
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_reengagement(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_reengagement_email(email, name, content["reason"], content["items"])


# ---------------------------------------------------------------------------
# Lifecycle: saved search matches. Ported bug-fixed from the dead
# check_saved_searches_task (it referenced SavedSearch.query, which doesn't
# exist -- the real field is search_query -- and Listing.title, which is
# also wrong -- the real field is title_en).

def _saved_search_eligible(db: Session, user: User) -> bool:
    search = db.exec(
        select(SavedSearch).where(SavedSearch.user_id == user.id).order_by(SavedSearch.created_at.desc())
    ).first()
    return search is not None


def _saved_search_content(db: Session, user: User) -> Optional[Dict[str, Any]]:
    search = db.exec(
        select(SavedSearch).where(SavedSearch.user_id == user.id).order_by(SavedSearch.created_at.desc())
    ).first()
    if not search:
        return None
    query = _active_listing_query().where(Listing.title_en.icontains(search.search_query))
    if search.category_id:
        query = query.where(Listing.category_id == search.category_id)
    pool = db.exec(query.order_by(Listing.created_at.desc()).limit(12)).all()
    if not pool:
        return None
    listings = _sample(pool, 3)
    search.last_email_sent = datetime.utcnow()
    db.add(search)
    db.commit()
    return {
        "listing_ids": [l.id for l in listings],
        "category_id": search.category_id,
        "shop_ids": [],
        "search_query": search.search_query,
        "items": [_listing_to_item(l) for l in listings],
    }


def _send_saved_search(email: str, name: str, subject: str, content: Dict[str, Any]) -> bool:
    return email_service.send_saved_search_alert(email, name, content["search_query"], content["items"])


# ---------------------------------------------------------------------------
# Catalog

CATALOG: Dict[str, CampaignDefinition] = {
    "promo_new_arrivals": CampaignDefinition(
        campaign_type="promo_new_arrivals",
        subject_variants=[
            "New products just added on Suqafuran",
            "Fresh listings you haven't seen yet",
            "Just in: new arrivals near you",
        ],
        cooldown_days=10, is_promotional=True,
        eligibility_fn=lambda db, user: _has_active_listings(db),
        content_selector_fn=_new_arrivals_content,
        send_fn=_send_new_arrivals,
    ),
    "promo_category_spotlight": CampaignDefinition(
        campaign_type="promo_category_spotlight",
        subject_variants=[
            "More from your favourite categories",
            "Picks based on what you've been browsing",
            "You might like these too",
        ],
        cooldown_days=14, is_promotional=True,
        eligibility_fn=lambda db, user: True,
        content_selector_fn=_category_spotlight_content,
        send_fn=_send_category_spotlight,
    ),
    "promo_trending": CampaignDefinition(
        campaign_type="promo_trending",
        subject_variants=[
            "What's trending on Suqafuran",
            "The most-viewed listings right now",
            "See what everyone's looking at",
        ],
        cooldown_days=10, is_promotional=True,
        eligibility_fn=lambda db, user: _has_active_listings(db),
        content_selector_fn=_trending_content,
        send_fn=_send_trending,
    ),
    "promo_shop_spotlight": CampaignDefinition(
        campaign_type="promo_shop_spotlight",
        subject_variants=[
            "Discover this week's featured shop",
            "A shop worth checking out",
            "Meet one of our top sellers",
        ],
        cooldown_days=21, is_promotional=True,
        eligibility_fn=lambda db, user: True,
        content_selector_fn=_shop_spotlight_content,
        send_fn=_send_shop_spotlight,
    ),
    "promo_personalized": CampaignDefinition(
        campaign_type="promo_personalized",
        subject_variants=[
            "Products you may be interested in",
            "Picked for you",
            "Based on what caught your eye",
        ],
        cooldown_days=14, is_promotional=True,
        eligibility_fn=lambda db, user: True,
        content_selector_fn=_personalized_content,
        send_fn=_send_personalized,
    ),
    "promo_new_shops": CampaignDefinition(
        campaign_type="promo_new_shops",
        subject_variants=[
            "New shops have joined Suqafuran",
            "Discover new shops near you",
            "Fresh sellers worth a look",
        ],
        cooldown_days=21, is_promotional=True,
        eligibility_fn=lambda db, user: True,
        content_selector_fn=_new_shops_content,
        send_fn=_send_new_shops,
    ),
    "weekly_digest": CampaignDefinition(
        campaign_type="weekly_digest",
        subject_variants=["This week on Suqafuran"],
        cooldown_days=6, is_promotional=False,
        eligibility_fn=lambda db, user: True,
        content_selector_fn=_weekly_digest_content,
        send_fn=_send_weekly_digest,
    ),
    "reengagement": CampaignDefinition(
        campaign_type="reengagement",
        subject_variants=[
            "New products are waiting for you",
            "Come back and discover what's new",
            "It's been a while — see what's changed",
        ],
        cooldown_days=21, is_promotional=False,
        eligibility_fn=_reengagement_eligible,
        content_selector_fn=_reengagement_content,
        send_fn=_send_reengagement,
    ),
    "saved_search_match": CampaignDefinition(
        campaign_type="saved_search_match",
        subject_variants=["New listings match your saved search"],
        cooldown_days=3, is_promotional=False,
        eligibility_fn=_saved_search_eligible,
        content_selector_fn=_saved_search_content,
        send_fn=_send_saved_search,
    ),
}
