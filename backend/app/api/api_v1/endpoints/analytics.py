"""Analytics endpoints for tracking and reporting engagement metrics."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select, func
from datetime import datetime, timedelta
from typing import Any, List, Optional
from app.api import deps
from app.models.analytics import ItemView, ShopView
from app.models.user import User

router = APIRouter()


@router.post("/track/item-view")
def track_item_view(
    *,
    db: Session = Depends(deps.get_db),
    listing_id: int,
    time_spent_seconds: int = 0,
    device_type: Optional[str] = None,
    referrer: Optional[str] = None,
    request: Request,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Track when a user/guest views an item listing."""
    item_view = ItemView(
        listing_id=listing_id,
        user_id=current_user.id if current_user else None,
        device_type=device_type,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        time_spent_seconds=time_spent_seconds,
        referrer=referrer,
    )
    db.add(item_view)
    db.commit()
    db.refresh(item_view)
    return {"status": "ok", "view_id": item_view.id}


@router.post("/track/shop-view")
def track_shop_view(
    *,
    db: Session = Depends(deps.get_db),
    shop_owner_id: int,
    time_spent_seconds: int = 0,
    device_type: Optional[str] = None,
    referrer: Optional[str] = None,
    request: Request,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Track when a user/guest views a shop profile."""
    shop_view = ShopView(
        shop_owner_id=shop_owner_id,
        user_id=current_user.id if current_user else None,
        device_type=device_type,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        time_spent_seconds=time_spent_seconds,
        referrer=referrer,
    )
    db.add(shop_view)
    db.commit()
    db.refresh(shop_view)
    return {"status": "ok", "view_id": shop_view.id}


@router.get("/admin/top-items")
def get_top_items(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get top viewed items for admin dashboard."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get top items by view count
    from app.models.listing import Listing
    
    statement = (
        select(
            ItemView.listing_id,
            Listing.title_en,
            func.count(ItemView.id).label("view_count"),
            func.count(func.distinct(ItemView.user_id)).label("unique_users"),
            func.count(func.distinct(ItemView.ip_address)).label("unique_guests"),
        )
        .join(Listing, ItemView.listing_id == Listing.id)
        .where(ItemView.viewed_at >= cutoff_date)
        .group_by(ItemView.listing_id, Listing.title_en)
        .order_by(func.count(ItemView.id).desc())
        .limit(limit)
    )

    results = db.exec(statement).all()

    return {
        "period_days": days,
        "items": [
            {
                "listing_id": r[0],
                "listing_title": r[1] or f"Listing #{r[0]}",
                "view_count": r[2],
                "unique_users": r[3],
                "unique_guests": r[4],
                "total_unique_visitors": r[3] + r[4],
            }
            for r in results
        ]
    }


@router.get("/admin/top-shops")
def get_top_shops(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get top viewed shops for admin dashboard."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get top shops by view count
    statement = (
        select(
            ShopView.shop_owner_id,
            User.full_name,
            func.count(ShopView.id).label("view_count"),
            func.count(func.distinct(ShopView.user_id)).label("unique_users"),
            func.count(func.distinct(ShopView.ip_address)).label("unique_guests"),
        )
        .join(User, ShopView.shop_owner_id == User.id)
        .where(ShopView.viewed_at >= cutoff_date)
        .group_by(ShopView.shop_owner_id, User.full_name)
        .order_by(func.count(ShopView.id).desc())
        .limit(limit)
    )

    results = db.exec(statement).all()

    return {
        "period_days": days,
        "shops": [
            {
                "shop_owner_id": r[0],
                "shop_owner_name": r[1] or f"Shop #{r[0]}",
                "view_count": r[2],
                "unique_users": r[3],
                "unique_guests": r[4],
                "total_unique_visitors": r[3] + r[4],
            }
            for r in results
        ]
    }


@router.get("/admin/live-views")
def get_live_views(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    minutes: int = Query(5, ge=1, le=60),
) -> Any:
    """Get real-time view activity from the last N minutes."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)

    # Recent item views
    item_views = db.exec(
        select(ItemView)
        .where(ItemView.viewed_at >= cutoff_time)
        .order_by(ItemView.viewed_at.desc())
        .limit(50)
    ).all()

    # Recent shop views
    shop_views = db.exec(
        select(ShopView)
        .where(ShopView.viewed_at >= cutoff_time)
        .order_by(ShopView.viewed_at.desc())
        .limit(50)
    ).all()

    # Count totals
    item_view_count = db.exec(
        select(func.count(ItemView.id)).where(ItemView.viewed_at >= cutoff_time)
    ).one()

    shop_view_count = db.exec(
        select(func.count(ShopView.id)).where(ShopView.viewed_at >= cutoff_time)
    ).one()

    return {
        "time_window_minutes": minutes,
        "item_views_count": item_view_count,
        "shop_views_count": shop_view_count,
        "recent_item_views": [
            {
                "id": v.id,
                "listing_id": v.listing_id,
                "user_id": v.user_id,
                "device_type": v.device_type,
                "viewed_at": v.viewed_at.isoformat(),
            }
            for v in item_views
        ],
        "recent_shop_views": [
            {
                "id": v.id,
                "shop_owner_id": v.shop_owner_id,
                "user_id": v.user_id,
                "device_type": v.device_type,
                "viewed_at": v.viewed_at.isoformat(),
            }
            for v in shop_views
        ]
    }


@router.get("/admin/item-stats/{listing_id}")
def get_item_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    listing_id: int,
    days: int = Query(30, ge=1, le=365),
) -> Any:
    """Get detailed stats for a specific item."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    total_views = db.exec(
        select(func.count(ItemView.id))
        .where(ItemView.listing_id == listing_id, ItemView.viewed_at >= cutoff_date)
    ).one()

    unique_users = db.exec(
        select(func.count(func.distinct(ItemView.user_id)))
        .where(ItemView.listing_id == listing_id, ItemView.viewed_at >= cutoff_date)
    ).one()

    unique_guests = db.exec(
        select(func.count(func.distinct(ItemView.ip_address)))
        .where(
            ItemView.listing_id == listing_id,
            ItemView.user_id.is_(None),
            ItemView.viewed_at >= cutoff_date,
        )
    ).one()

    avg_time_spent = db.exec(
        select(func.avg(ItemView.time_spent_seconds))
        .where(ItemView.listing_id == listing_id, ItemView.viewed_at >= cutoff_date)
    ).one()

    return {
        "listing_id": listing_id,
        "period_days": days,
        "total_views": total_views or 0,
        "unique_user_views": unique_users or 0,
        "unique_guest_views": unique_guests or 0,
        "total_unique_visitors": (unique_users or 0) + (unique_guests or 0),
        "avg_time_spent_seconds": round(avg_time_spent) if avg_time_spent else 0,
    }


@router.get("/admin/shop-stats/{shop_owner_id}")
def get_shop_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    shop_owner_id: int,
    days: int = Query(30, ge=1, le=365),
) -> Any:
    """Get detailed stats for a specific shop."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    total_views = db.exec(
        select(func.count(ShopView.id))
        .where(ShopView.shop_owner_id == shop_owner_id, ShopView.viewed_at >= cutoff_date)
    ).one()

    unique_users = db.exec(
        select(func.count(func.distinct(ShopView.user_id)))
        .where(ShopView.shop_owner_id == shop_owner_id, ShopView.viewed_at >= cutoff_date)
    ).one()

    unique_guests = db.exec(
        select(func.count(func.distinct(ShopView.ip_address)))
        .where(
            ShopView.shop_owner_id == shop_owner_id,
            ShopView.user_id.is_(None),
            ShopView.viewed_at >= cutoff_date,
        )
    ).one()

    avg_time_spent = db.exec(
        select(func.avg(ShopView.time_spent_seconds))
        .where(ShopView.shop_owner_id == shop_owner_id, ShopView.viewed_at >= cutoff_date)
    ).one()

    return {
        "shop_owner_id": shop_owner_id,
        "period_days": days,
        "total_views": total_views or 0,
        "unique_user_views": unique_users or 0,
        "unique_guest_views": unique_guests or 0,
        "total_unique_visitors": (unique_users or 0) + (unique_guests or 0),
        "avg_time_spent_seconds": round(avg_time_spent) if avg_time_spent else 0,
    }


@router.post("/track/search")
def track_search(
    *,
    db: Session = Depends(deps.get_db),
    query: str,
    result_count: int = 0,
    device_type: Optional[str] = None,
    category_filter: Optional[str] = None,
    location_filter: Optional[str] = None,
    request: Request,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Track search queries for marketplace analytics."""
    from app.models.analytics import SearchEvent
    
    search_event = SearchEvent(
        query=query,
        result_count=result_count,
        user_id=current_user.id if current_user else None,
        device_type=device_type,
        ip_address=request.client.host if request.client else None,
        category_filter=category_filter,
        location_filter=location_filter,
    )
    db.add(search_event)
    db.commit()
    return {"status": "ok"}


@router.post("/track/click")
def track_click(
    *,
    db: Session = Depends(deps.get_db),
    event_type: str,
    listing_id: Optional[int] = None,
    shop_id: Optional[int] = None,
    device_type: Optional[str] = None,
    request: Request,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Track user clicks (chat, call, favorite, etc.)."""
    from app.models.analytics import ClickEvent
    
    click_event = ClickEvent(
        event_type=event_type,
        listing_id=listing_id,
        shop_id=shop_id,
        user_id=current_user.id if current_user else None,
        device_type=device_type,
        ip_address=request.client.host if request.client else None,
    )
    db.add(click_event)
    db.commit()
    return {"status": "ok"}


@router.post("/track/conversion")
def track_conversion(
    *,
    db: Session = Depends(deps.get_db),
    stage: str,
    listing_id: Optional[int] = None,
    shop_id: Optional[int] = None,
    device_type: Optional[str] = None,
    request: Request,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Track conversion funnel events."""
    from app.models.analytics import ConversionFunnelEvent
    
    event = ConversionFunnelEvent(
        stage=stage,
        listing_id=listing_id,
        shop_id=shop_id,
        user_id=current_user.id if current_user else None,
        device_type=device_type,
        ip_address=request.client.host if request.client else None,
    )
    db.add(event)
    db.commit()
    return {"status": "ok"}


@router.get("/admin/overview")
def get_overview(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
) -> Any:
    """Get overview analytics for dashboard."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ItemView, ShopView, ClickEvent, SearchEvent
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Total visitors (unique users + guests by IP)
    total_item_views = db.exec(
        select(func.count(ItemView.id)).where(ItemView.viewed_at >= cutoff_date)
    ).one() or 0
    
    total_shop_views = db.exec(
        select(func.count(ShopView.id)).where(ShopView.viewed_at >= cutoff_date)
    ).one() or 0

    # Unique visitors
    unique_users = db.exec(
        select(func.count(func.distinct(ItemView.user_id))).where(
            ItemView.viewed_at >= cutoff_date, ItemView.user_id.isnot(None)
        )
    ).one() or 0

    unique_guests = db.exec(
        select(func.count(func.distinct(ItemView.ip_address))).where(
            ItemView.viewed_at >= cutoff_date, ItemView.user_id.is_(None)
        )
    ).one() or 0

    # Searches
    total_searches = db.exec(
        select(func.count(SearchEvent.id)).where(SearchEvent.searched_at >= cutoff_date)
    ).one() or 0

    # Clicks (chat, call, etc.)
    chat_clicks = db.exec(
        select(func.count(ClickEvent.id)).where(
            ClickEvent.event_type == 'chat', ClickEvent.clicked_at >= cutoff_date
        )
    ).one() or 0

    favorites = db.exec(
        select(func.count(ClickEvent.id)).where(
            ClickEvent.event_type == 'favorite', ClickEvent.clicked_at >= cutoff_date
        )
    ).one() or 0

    whatsapp_clicks = db.exec(
        select(func.count(ClickEvent.id)).where(
            ClickEvent.event_type == 'whatsapp', ClickEvent.clicked_at >= cutoff_date
        )
    ).one() or 0

    call_clicks = db.exec(
        select(func.count(ClickEvent.id)).where(
            ClickEvent.event_type == 'call', ClickEvent.clicked_at >= cutoff_date
        )
    ).one() or 0

    # Conversion rate (chats / views)
    total_views = total_item_views + total_shop_views
    conversion_rate = round((chat_clicks / total_views * 100) if total_views > 0 else 0, 2)

    return {
        "period_days": days,
        "total_visitors": unique_users + unique_guests,
        "unique_users": unique_users,
        "unique_guests": unique_guests,
        "total_item_views": total_item_views,
        "total_shop_views": total_shop_views,
        "total_views": total_views,
        "total_searches": total_searches,
        "chat_clicks": chat_clicks,
        "whatsapp_clicks": whatsapp_clicks,
        "call_clicks": call_clicks,
        "favorites_added": favorites,
        "conversion_rate": conversion_rate,
    }


@router.get("/admin/search-analytics")
def get_search_analytics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get search analytics: top searches and no-result searches."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import SearchEvent
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Top searches (by frequency)
    top_searches = db.exec(
        select(
            SearchEvent.query,
            func.count(SearchEvent.id).label("search_count"),
            func.avg(SearchEvent.result_count).label("avg_results"),
        )
        .where(SearchEvent.searched_at >= cutoff_date)
        .group_by(SearchEvent.query)
        .order_by(func.count(SearchEvent.id).desc())
        .limit(limit)
    ).all()

    # No-result searches
    no_results = db.exec(
        select(
            SearchEvent.query,
            func.count(SearchEvent.id).label("search_count"),
        )
        .where(
            SearchEvent.searched_at >= cutoff_date,
            SearchEvent.result_count == 0,
        )
        .group_by(SearchEvent.query)
        .order_by(func.count(SearchEvent.id).desc())
        .limit(limit)
    ).all()

    return {
        "period_days": days,
        "top_searches": [
            {
                "query": q[0],
                "search_count": q[1],
                "avg_results": round(q[2]) if q[2] else 0,
            }
            for q in top_searches
        ],
        "no_result_searches": [
            {
                "query": q[0],
                "search_count": q[1],
            }
            for q in no_results
        ],
    }


@router.get("/admin/category-analytics")
def get_category_analytics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get category performance analytics."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ItemView
    from app.models.listing import Listing, Category

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get category stats
    results = db.exec(
        select(
            Listing.category_id,
            Category.name_en,
            func.count(ItemView.id).label("view_count"),
            func.count(func.distinct(Listing.id)).label("listing_count"),
        )
        .join(ItemView, ItemView.listing_id == Listing.id)
        .join(Category, Category.id == Listing.category_id, isouter=True)
        .where(ItemView.viewed_at >= cutoff_date)
        .group_by(Listing.category_id, Category.name_en)
        .order_by(func.count(ItemView.id).desc())
        .limit(limit)
    ).all()

    return {
        "period_days": days,
        "categories": [
            {
                "category_id": r[0],
                "category_name": r[1] or f"Category #{r[0]}",
                "view_count": r[2],
                "listing_count": r[3],
                "ctr": round((r[2] / max(r[3], 1) * 100), 2),
            }
            for r in results
        ]
    }


@router.get("/admin/conversion-funnel")
def get_conversion_funnel(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
) -> Any:
    """Get conversion funnel analytics: View -> Click -> Chat -> Contact."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ItemView, ClickEvent
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Stage counts
    views = db.exec(
        select(func.count(ItemView.id)).where(ItemView.viewed_at >= cutoff_date)
    ).one() or 1

    clicks = db.exec(
        select(func.count(ClickEvent.id)).where(ClickEvent.clicked_at >= cutoff_date)
    ).one() or 0

    chats = db.exec(
        select(func.count(ClickEvent.id)).where(
            ClickEvent.event_type == 'chat', ClickEvent.clicked_at >= cutoff_date
        )
    ).one() or 0

    # Orders that followed a buyer-seller conversation on the same listing.
    # No FK exists between MarketplaceConversation and Order, so this is a
    # best-effort match on (buyer=customer, seller, listing=product) with the
    # conversation predating the order.
    from app.models.marketplace_conversation import MarketplaceConversation
    from app.models.order import Order, OrderItem

    conv_rows = db.exec(
        select(
            MarketplaceConversation.buyer_id,
            MarketplaceConversation.seller_id,
            MarketplaceConversation.listing_id,
            MarketplaceConversation.created_at,
        ).where(MarketplaceConversation.created_at >= cutoff_date)
    ).all()

    try:
        order_rows = db.exec(
            select(
                Order.customer_id,
                Order.seller_id,
                OrderItem.product_id,
                Order.created_at,
            )
            .join(OrderItem, OrderItem.order_id == Order.id)
            .where(Order.created_at >= cutoff_date)
        ).all()
    except Exception:
        # Order/OrderItem tables may not be provisioned in every environment
        # (e.g. a pending migration) -- degrade gracefully instead of 500ing
        # the whole funnel over an optional, best-effort stage.
        db.rollback()
        order_rows = []

    conv_earliest: dict = {}
    for buyer_id, seller_id, listing_id, created_at in conv_rows:
        if listing_id is None:
            continue
        key = (buyer_id, seller_id, listing_id)
        if key not in conv_earliest or created_at < conv_earliest[key]:
            conv_earliest[key] = created_at

    orders_from_chat = 0
    for customer_id, seller_id, product_id, order_created_at in order_rows:
        conv_time = conv_earliest.get((customer_id, seller_id, product_id))
        if conv_time is not None and conv_time <= order_created_at:
            orders_from_chat += 1

    from app.models.meeting_deal import Deal

    buyer_confirmed_count = db.exec(
        select(func.count(Deal.id)).where(
            Deal.buyer_confirmed_at.isnot(None), Deal.buyer_confirmed_at >= cutoff_date
        )
    ).one() or 0

    return {
        "period_days": days,
        "funnel": [
            {
                "stage": "Views",
                "count": views,
                "percentage": 100,
            },
            {
                "stage": "Clicks",
                "count": clicks,
                "percentage": round((clicks / views * 100), 2),
            },
            {
                "stage": "Chats Started",
                "count": chats,
                "percentage": round((chats / views * 100), 2),
            },
            {
                "stage": "Buyer Confirmed",
                "count": buyer_confirmed_count,
                "percentage": round((buyer_confirmed_count / views * 100), 2),
            },
            {
                "stage": "Orders",
                "count": orders_from_chat,
                "percentage": round((orders_from_chat / views * 100), 2),
            },
        ]
    }


# Phase 2: Listing, Shop, Geographic, User Analytics

@router.get("/admin/listing-stats/{listing_id}")
def get_listing_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    listing_id: int,
    days: int = Query(30, ge=1, le=365),
) -> Any:
    """Get detailed stats for a specific listing."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ItemView, ClickEvent
    from app.models.listing import Listing

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get listing title
    listing = db.get(Listing, listing_id)
    listing_title = listing.title_en if listing else f"Listing #{listing_id}"

    # Views
    total_views = db.exec(
        select(func.count(ItemView.id))
        .where(ItemView.listing_id == listing_id, ItemView.viewed_at >= cutoff_date)
    ).one() or 0

    unique_viewers = db.exec(
        select(func.count(func.distinct(ItemView.user_id)))
        .where(ItemView.listing_id == listing_id, ItemView.viewed_at >= cutoff_date)
    ).one() or 0

    # Clicks
    chat_clicks = db.exec(
        select(func.count(ClickEvent.id))
        .where(
            ClickEvent.listing_id == listing_id,
            ClickEvent.event_type == "chat",
            ClickEvent.clicked_at >= cutoff_date,
        )
    ).one() or 0

    favorites = db.exec(
        select(func.count(ClickEvent.id))
        .where(
            ClickEvent.listing_id == listing_id,
            ClickEvent.event_type == "favorite",
            ClickEvent.clicked_at >= cutoff_date,
        )
    ).one() or 0

    whatsapp_clicks = db.exec(
        select(func.count(ClickEvent.id))
        .where(
            ClickEvent.listing_id == listing_id,
            ClickEvent.event_type == "whatsapp",
            ClickEvent.clicked_at >= cutoff_date,
        )
    ).one() or 0

    return {
        "listing_id": listing_id,
        "listing_title": listing_title,
        "period_days": days,
        "total_views": total_views,
        "unique_viewers": unique_viewers,
        "chat_clicks": chat_clicks,
        "whatsapp_clicks": whatsapp_clicks,
        "favorites": favorites,
        "engagement_rate": round((chat_clicks / total_views * 100) if total_views > 0 else 0, 2),
    }


@router.get("/admin/geographic-analytics")
def get_geographic_analytics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get visitor analytics by city/country with map coordinates."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import GeographicEvent

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Visitors by city
    city_stats = db.exec(
        select(
            GeographicEvent.city,
            GeographicEvent.latitude,
            GeographicEvent.longitude,
            GeographicEvent.country,
            func.count(GeographicEvent.id).label("visitor_count"),
            func.count(func.distinct(GeographicEvent.user_id)).label("unique_users"),
        )
        .where(
            GeographicEvent.created_at >= cutoff_date,
            GeographicEvent.city.isnot(None),
        )
        .group_by(
            GeographicEvent.city,
            GeographicEvent.latitude,
            GeographicEvent.longitude,
            GeographicEvent.country,
        )
        .order_by(func.count(GeographicEvent.id).desc())
        .limit(limit)
    ).all()

    # Visitors by country
    country_stats = db.exec(
        select(
            GeographicEvent.country,
            func.count(GeographicEvent.id).label("visitor_count"),
            func.count(func.distinct(GeographicEvent.user_id)).label("unique_users"),
        )
        .where(
            GeographicEvent.created_at >= cutoff_date,
            GeographicEvent.country.isnot(None),
        )
        .group_by(GeographicEvent.country)
        .order_by(func.count(GeographicEvent.id).desc())
        .limit(limit)
    ).all()

    return {
        "period_days": days,
        "cities": [
            {
                "city": c[0],
                "latitude": c[1],
                "longitude": c[2],
                "country": c[3],
                "visitor_count": c[4],
                "unique_users": c[5],
            }
            for c in city_stats
        ],
        "countries": [
            {
                "country": c[0],
                "visitor_count": c[1],
                "unique_users": c[2],
            }
            for c in country_stats
        ],
    }


@router.get("/admin/user-analytics")
def get_user_analytics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
) -> Any:
    """Get user cohort analytics: new, returning, sellers."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import UserCohort

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # New users (first visit in period)
    new_users = db.exec(
        select(func.count(UserCohort.id))
        .where(UserCohort.first_visit_at >= cutoff_date)
    ).one() or 0

    # Returning users (visited before period)
    returning_users = db.exec(
        select(func.count(UserCohort.id))
        .where(
            UserCohort.first_visit_at < cutoff_date,
            UserCohort.last_visit_at >= cutoff_date,
        )
    ).one() or 0

    # Active sellers
    active_sellers = db.exec(
        select(func.count(UserCohort.id))
        .where(UserCohort.is_seller == True)
    ).one() or 0

    # Verified sellers
    verified_sellers = db.exec(
        select(func.count(UserCohort.id))
        .where(UserCohort.is_seller == True, UserCohort.is_verified == True)
    ).one() or 0

    # Top users by activity (with names)
    from app.models.user import User as UserModel
    
    top_users = db.exec(
        select(
            UserCohort.user_id,
            UserModel.full_name,
            UserCohort.total_searches,
            UserCohort.total_clicks,
            UserCohort.total_chats,
            UserCohort.visit_count,
        )
        .join(UserModel, UserCohort.user_id == UserModel.id)
        .order_by(UserCohort.total_chats.desc())
        .limit(10)
    ).all()

    return {
        "period_days": days,
        "new_users": new_users,
        "returning_users": returning_users,
        "total_active_sellers": active_sellers,
        "verified_sellers": verified_sellers,
        "top_users": [
            {
                "user_id": u[0],
                "user_name": u[1] or f"User #{u[0]}",
                "searches": u[2],
                "clicks": u[3],
                "chats": u[4],
                "visits": u[5],
            }
            for u in top_users
        ],
    }


# Phase 3: Device Analytics, Seller Rankings, Admin Alerts

@router.get("/admin/device-analytics")
def get_device_analytics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
) -> Any:
    """Get device type distribution analytics."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ItemView, ShopView

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Device distribution for views
    device_dist = db.exec(
        select(
            ItemView.device_type,
            func.count(ItemView.id).label("count"),
        )
        .where(ItemView.viewed_at >= cutoff_date, ItemView.device_type.isnot(None))
        .group_by(ItemView.device_type)
        .order_by(func.count(ItemView.id).desc())
    ).all()

    # Shop views by device
    shop_device_dist = db.exec(
        select(
            ShopView.device_type,
            func.count(ShopView.id).label("count"),
        )
        .where(ShopView.viewed_at >= cutoff_date, ShopView.device_type.isnot(None))
        .group_by(ShopView.device_type)
        .order_by(func.count(ShopView.id).desc())
    ).all()

    total_views = sum(d[1] for d in device_dist) or 1

    return {
        "period_days": days,
        "item_views_by_device": [
            {
                "device_type": d[0] or "unknown",
                "count": d[1],
                "percentage": round((d[1] / total_views * 100), 2),
            }
            for d in device_dist
        ],
        "shop_views_by_device": [
            {
                "device_type": d[0] or "unknown",
                "count": d[1],
            }
            for d in shop_device_dist
        ],
    }


@router.get("/admin/seller-rankings")
def get_seller_rankings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(30, ge=1, le=365),
    metric: str = Query("views", regex="^(views|chats|conversions)$"),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get seller performance rankings by metric."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ShopView, ClickEvent
    from app.models.user import User as UserModel

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    if metric == "views":
        results = db.exec(
            select(
                ShopView.shop_owner_id,
                UserModel.full_name,
                func.count(ShopView.id).label("metric_value"),
            )
            .join(UserModel, ShopView.shop_owner_id == UserModel.id)
            .where(ShopView.viewed_at >= cutoff_date)
            .group_by(ShopView.shop_owner_id, UserModel.full_name)
            .order_by(func.count(ShopView.id).desc())
            .limit(limit)
        ).all()
    elif metric == "chats":
        results = db.exec(
            select(
                ClickEvent.shop_id,
                UserModel.full_name,
                func.count(ClickEvent.id).label("metric_value"),
            )
            .join(UserModel, ClickEvent.shop_id == UserModel.id)
            .where(
                ClickEvent.event_type == "chat",
                ClickEvent.clicked_at >= cutoff_date,
            )
            .group_by(ClickEvent.shop_id, UserModel.full_name)
            .order_by(func.count(ClickEvent.id).desc())
            .limit(limit)
        ).all()
    else:  # conversions
        results = db.exec(
            select(
                ClickEvent.shop_id,
                UserModel.full_name,
                func.count(ClickEvent.id).label("metric_value"),
            )
            .join(UserModel, ClickEvent.shop_id == UserModel.id)
            .where(
                ClickEvent.event_type.in_(["chat", "whatsapp", "call"]),
                ClickEvent.clicked_at >= cutoff_date,
            )
            .group_by(ClickEvent.shop_id, UserModel.full_name)
            .order_by(func.count(ClickEvent.id).desc())
            .limit(limit)
        ).all()

    return {
        "metric": metric,
        "period_days": days,
        "rankings": [
            {
                "rank": idx + 1,
                "shop_id": r[0],
                "shop_name": r[1] or f"Shop #{r[0]}",
                "value": r[2],
            }
            for idx, r in enumerate(results)
        ],
    }


@router.get("/admin/alerts")
def get_alerts(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get all active alert rules."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import AdminAlert

    alerts = db.exec(select(AdminAlert).where(AdminAlert.enabled == True)).all()

    return {
        "alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "metric": a.metric,
                "threshold": a.threshold,
                "comparison": a.comparison,
                "description": a.description,
                "notify_admin": a.notify_admin,
                "notify_seller": a.notify_seller,
            }
            for a in alerts
        ]
    }


@router.get("/admin/alert-events")
def get_alert_events(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    status: str = Query("triggered", regex="^(triggered|acknowledged|resolved)$"),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    """Get recent alert events."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import AlertEvent

    events = db.exec(
        select(AlertEvent)
        .where(AlertEvent.status == status)
        .order_by(AlertEvent.created_at.desc())
        .limit(limit)
    ).all()

    return {
        "status": status,
        "events": [
            {
                "id": e.id,
                "alert_type": e.alert_type,
                "metric_value": e.metric_value,
                "threshold": e.threshold,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "message": e.message,
                "created_at": e.created_at.isoformat(),
                "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
            }
            for e in events
        ],
    }


@router.post("/admin/alert/{alert_event_id}/acknowledge")
def acknowledge_alert(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    alert_event_id: str,
) -> Any:
    """Mark an alert as acknowledged."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import AlertEvent

    event = db.get(AlertEvent, alert_event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Alert event not found")

    event.status = "acknowledged"
    event.acknowledged_at = datetime.utcnow()
    db.add(event)
    db.commit()

    return {"status": "acknowledged"}


# Phase 4: Communication Analytics (real buyer-seller chat, not click-intent)

@router.get("/admin/communication-overview")
def get_communication_overview(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(7, ge=1, le=90),
) -> Any:
    """Get buyer-seller communication analytics from the real chat system."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.marketplace_conversation import MarketplaceConversation
    from app.models.message import Message
    from app.models.order import Order, OrderItem

    cutoff_date = datetime.utcnow() - timedelta(days=days)
    active_cutoff = datetime.utcnow() - timedelta(hours=24)

    active_conversations = db.exec(
        select(func.count(MarketplaceConversation.id)).where(
            MarketplaceConversation.status.notin_(["closed", "suspended"]),
            MarketplaceConversation.last_message_at >= active_cutoff,
        )
    ).one() or 0

    new_conversations = db.exec(
        select(func.count(MarketplaceConversation.id)).where(
            MarketplaceConversation.created_at >= cutoff_date
        )
    ).one() or 0

    messages_total = db.exec(
        select(func.count(Message.id)).where(Message.created_at >= cutoff_date)
    ).one() or 0

    messages_per_hour = round(messages_total / max(days * 24, 1), 2)

    unanswered_conversations = db.exec(
        select(func.count(MarketplaceConversation.id)).where(
            MarketplaceConversation.seller_unread_count > 0,
            MarketplaceConversation.last_message_at >= cutoff_date,
        )
    ).one() or 0

    # Response time: walk ordered messages per conversation in the window
    # (capped) computing buyer -> next-seller-message deltas. There is no
    # stored read_at/response-time field to read this from directly.
    conv_rows = db.exec(
        select(
            MarketplaceConversation.id,
            MarketplaceConversation.buyer_id,
            MarketplaceConversation.seller_id,
            MarketplaceConversation.listing_id,
            MarketplaceConversation.created_at,
        ).where(MarketplaceConversation.last_message_at >= cutoff_date)
    ).all()
    conv_parties = {c[0]: (c[1], c[2], c[3], c[4]) for c in conv_rows}

    response_deltas: list = []
    first_response_deltas: list = []

    if conv_parties:
        messages = db.exec(
            select(Message.conversation_id, Message.sender_id, Message.created_at)
            .where(
                Message.created_at >= cutoff_date,
                Message.conversation_id.in_(list(conv_parties.keys())),
            )
            .order_by(Message.conversation_id, Message.created_at)
            .limit(5000)
        ).all()

        by_conv: dict = {}
        for conv_id, sender_id, created_at in messages:
            by_conv.setdefault(conv_id, []).append((sender_id, created_at))

        for conv_id, msgs in by_conv.items():
            buyer_id, seller_id, _listing_id, _created = conv_parties[conv_id]
            first_found = False
            for i in range(1, len(msgs)):
                prev_sender, prev_time = msgs[i - 1]
                cur_sender, cur_time = msgs[i]
                if prev_sender == buyer_id and cur_sender == seller_id:
                    delta = (cur_time - prev_time).total_seconds()
                    response_deltas.append(delta)
                    if not first_found:
                        first_response_deltas.append(delta)
                        first_found = True

    avg_response_seconds = round(sum(response_deltas) / len(response_deltas)) if response_deltas else 0
    avg_first_response_seconds = round(sum(first_response_deltas) / len(first_response_deltas)) if first_response_deltas else 0

    # Conversation -> order conversion (best-effort match, no FK exists).
    try:
        order_rows = db.exec(
            select(
                Order.customer_id,
                Order.seller_id,
                OrderItem.product_id,
                Order.created_at,
            )
            .join(OrderItem, OrderItem.order_id == Order.id)
            .where(Order.created_at >= cutoff_date)
        ).all()
    except Exception:
        db.rollback()
        order_rows = []

    order_times_by_triplet: dict = {}
    for customer_id, seller_id, product_id, order_created_at in order_rows:
        order_times_by_triplet.setdefault((customer_id, seller_id, product_id), []).append(order_created_at)

    converted_conversations = 0
    total_conversations = len(conv_parties)
    for buyer_id, seller_id, listing_id, conv_created in conv_parties.values():
        if listing_id is None:
            continue
        order_times = order_times_by_triplet.get((buyer_id, seller_id, listing_id))
        if order_times and any(t >= conv_created for t in order_times):
            converted_conversations += 1

    conversation_to_order_rate = (
        round((converted_conversations / total_conversations * 100), 2) if total_conversations > 0 else 0
    )

    return {
        "period_days": days,
        "active_conversations": active_conversations,
        "new_conversations": new_conversations,
        "messages_total": messages_total,
        "messages_per_hour": messages_per_hour,
        "unanswered_conversations": unanswered_conversations,
        "avg_response_seconds": avg_response_seconds,
        "avg_first_response_seconds": avg_first_response_seconds,
        "conversation_to_order_rate": conversation_to_order_rate,
    }


@router.get("/admin/seller-response-analytics")
def get_seller_response_analytics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get per-seller response rate and response time, ranked by response rate."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.marketplace_conversation import MarketplaceConversation
    from app.models.message import Message
    from app.models.user import User as UserModel

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    conv_rows = db.exec(
        select(
            MarketplaceConversation.id,
            MarketplaceConversation.buyer_id,
            MarketplaceConversation.seller_id,
            MarketplaceConversation.seller_unread_count,
        ).where(MarketplaceConversation.last_message_at >= cutoff_date)
    ).all()

    if not conv_rows:
        return {"period_days": days, "sellers": []}

    conv_ids = [c[0] for c in conv_rows]

    messages = db.exec(
        select(Message.conversation_id, Message.sender_id, Message.created_at)
        .where(Message.conversation_id.in_(conv_ids))
        .order_by(Message.conversation_id, Message.created_at)
    ).all()

    by_conv: dict = {}
    for conv_id, sender_id, created_at in messages:
        by_conv.setdefault(conv_id, []).append((sender_id, created_at))

    seller_stats: dict = {}
    for conv_id, buyer_id, seller_id, seller_unread in conv_rows:
        s = seller_stats.setdefault(seller_id, {"chats": 0, "responded": 0, "deltas": [], "unanswered": 0})
        s["chats"] += 1
        if seller_unread > 0:
            s["unanswered"] += 1
        msgs = by_conv.get(conv_id, [])
        if any(sender_id == seller_id for sender_id, _ in msgs):
            s["responded"] += 1
        for i in range(1, len(msgs)):
            prev_sender, prev_time = msgs[i - 1]
            cur_sender, cur_time = msgs[i]
            if prev_sender == buyer_id and cur_sender == seller_id:
                s["deltas"].append((cur_time - prev_time).total_seconds())

    seller_ids = list(seller_stats.keys())
    names = dict(
        db.exec(select(UserModel.id, UserModel.full_name).where(UserModel.id.in_(seller_ids))).all()
    ) if seller_ids else {}

    results = []
    for seller_id, s in seller_stats.items():
        response_rate = round((s["responded"] / s["chats"] * 100), 2) if s["chats"] > 0 else 0
        avg_response = round(sum(s["deltas"]) / len(s["deltas"])) if s["deltas"] else 0
        results.append({
            "seller_id": seller_id,
            "seller_name": names.get(seller_id) or f"Seller #{seller_id}",
            "chats": s["chats"],
            "response_rate": response_rate,
            "avg_response_seconds": avg_response,
            "unanswered": s["unanswered"],
        })

    results.sort(key=lambda r: r["response_rate"], reverse=True)

    return {"period_days": days, "sellers": results[:limit]}


@router.get("/admin/hot-listings")
def get_hot_listings(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(1, ge=1, le=30),
    limit: int = Query(6, ge=1, le=50),
) -> Any:
    """Get listings trending right now, ranked by recent view/click/favorite momentum."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.analytics import ItemView, ClickEvent
    from app.models.listing import Listing

    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=days)
    prior_cutoff = recent_cutoff - timedelta(days=days)

    recent_views = db.exec(
        select(ItemView.listing_id, func.count(ItemView.id))
        .where(ItemView.viewed_at >= recent_cutoff)
        .group_by(ItemView.listing_id)
    ).all()
    prior_views = db.exec(
        select(ItemView.listing_id, func.count(ItemView.id))
        .where(ItemView.viewed_at >= prior_cutoff, ItemView.viewed_at < recent_cutoff)
        .group_by(ItemView.listing_id)
    ).all()

    recent_clicks = db.exec(
        select(ClickEvent.listing_id, ClickEvent.event_type, func.count(ClickEvent.id))
        .where(
            ClickEvent.clicked_at >= recent_cutoff,
            ClickEvent.listing_id.isnot(None),
        )
        .group_by(ClickEvent.listing_id, ClickEvent.event_type)
    ).all()

    recent_views_map = {r[0]: r[1] for r in recent_views}
    prior_views_map = {r[0]: r[1] for r in prior_views}

    clicks_map: dict = {}
    favorites_map: dict = {}
    for listing_id, event_type, count in recent_clicks:
        if event_type == "favorite":
            favorites_map[listing_id] = favorites_map.get(listing_id, 0) + count
        elif event_type in ("chat", "whatsapp", "call"):
            clicks_map[listing_id] = clicks_map.get(listing_id, 0) + count

    listing_ids = set(recent_views_map) | set(clicks_map) | set(favorites_map)
    if not listing_ids:
        return {"period_days": days, "listings": []}

    listings = db.exec(
        select(Listing.id, Listing.title_en).where(Listing.id.in_(listing_ids))
    ).all()
    titles = {l[0]: l[1] for l in listings}

    results = []
    for listing_id in listing_ids:
        views = recent_views_map.get(listing_id, 0)
        clicks = clicks_map.get(listing_id, 0)
        favorites = favorites_map.get(listing_id, 0)
        prior = prior_views_map.get(listing_id, 0)
        pct_change = round(((views - prior) / prior * 100), 1) if prior > 0 else (100.0 if views > 0 else 0.0)
        score = views + clicks * 3 + favorites * 2
        results.append({
            "listing_id": listing_id,
            "listing_title": titles.get(listing_id) or f"Listing #{listing_id}",
            "views": views,
            "chats": clicks,
            "favorites": favorites,
            "pct_change": pct_change,
            "score": score,
        })

    results.sort(key=lambda r: r["score"], reverse=True)

    return {"period_days": days, "listings": results[:limit]}


@router.get("/admin/sales-attribution")
def get_sales_attribution(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    days: int = Query(30, ge=1, le=365),
) -> Any:
    """
    Cross-channel sales attribution: which acquisition channel a buyer
    signed up through (User.referral_code -> MarketingCode), joined
    against their actual purchases (CheckoutReceipt). Buyers with no
    referral_code are bucketed as "Organic / Direct".

    This is a signup-channel attribution, not a per-purchase UTM/click
    attribution -- there's no campaign tracking captured at checkout
    time today, only at signup, so a repeat buyer's later purchases are
    still attributed to whatever channel first brought them to the
    platform.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.checkout_receipt import CheckoutReceipt
    from app.models.marketing_code import MarketingCode

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    receipts = db.exec(
        select(CheckoutReceipt.buyer_id, CheckoutReceipt.total_amount)
        .where(CheckoutReceipt.created_at >= cutoff_date)
    ).all()

    if not receipts:
        return {"period_days": days, "channels": [], "total_orders": 0, "total_revenue": 0}

    buyer_ids = list({r[0] for r in receipts})
    buyer_codes = dict(
        db.exec(
            select(User.id, User.referral_code).where(User.id.in_(buyer_ids))
        ).all()
    )

    codes_used = {code for code in buyer_codes.values() if code}
    code_labels: dict = {}
    if codes_used:
        marketing_codes = db.exec(
            select(MarketingCode.code, MarketingCode.description).where(MarketingCode.code.in_(codes_used))
        ).all()
        code_labels = {code: (description or code) for code, description in marketing_codes}

    channel_stats: dict = {}
    for buyer_id, total_amount in receipts:
        code = buyer_codes.get(buyer_id)
        channel = code_labels.get(code, code) if code else "Organic / Direct"
        s = channel_stats.setdefault(channel, {"orders": 0, "revenue": 0.0})
        s["orders"] += 1
        s["revenue"] += total_amount or 0

    total_orders = len(receipts)
    total_revenue = sum(total_amount or 0 for _, total_amount in receipts)

    channels = [
        {
            "channel": channel,
            "orders": s["orders"],
            "revenue": round(s["revenue"], 2),
            "revenue_share": round((s["revenue"] / total_revenue * 100), 2) if total_revenue > 0 else 0,
        }
        for channel, s in channel_stats.items()
    ]
    channels.sort(key=lambda c: c["revenue"], reverse=True)

    return {
        "period_days": days,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "channels": channels,
    }


@router.get("/admin/buyer-seller-activity")
def get_buyer_seller_activity(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    buyer_id: int,
    seller_id: int,
    listing_id: int,
) -> Any:
    """
    Merged, timestamp-sorted activity timeline for one (buyer, seller,
    listing) triplet -- views, wishlist/chat/call/whatsapp clicks, chat
    messages, and purchase-confirmation events. No dedicated storage:
    this reads straight from ItemView/ClickEvent/Message/Deal.
    """
    if not (current_user.is_admin or current_user.id in (buyer_id, seller_id)):
        raise HTTPException(status_code=403, detail="Not authorized to view this activity")

    from app.models.analytics import ItemView, ClickEvent
    from app.models.marketplace_conversation import MarketplaceConversation
    from app.models.message import Message
    from app.models.meeting_deal import Deal

    events: list = []

    views = db.exec(
        select(ItemView.viewed_at).where(
            ItemView.listing_id == listing_id, ItemView.user_id == buyer_id
        )
    ).all()
    for viewed_at in views:
        events.append({"timestamp": viewed_at, "event": "Viewed product", "actor": "buyer"})

    clicks = db.exec(
        select(ClickEvent.event_type, ClickEvent.clicked_at).where(
            ClickEvent.listing_id == listing_id, ClickEvent.user_id == buyer_id
        )
    ).all()
    click_labels = {
        "favorite": "Added to wishlist",
        "chat": "Started conversation",
        "call": "Clicked call",
        "whatsapp": "Clicked WhatsApp",
    }
    for event_type, clicked_at in clicks:
        events.append({"timestamp": clicked_at, "event": click_labels.get(event_type, event_type), "actor": "buyer"})

    conversation = db.exec(
        select(MarketplaceConversation.id).where(
            MarketplaceConversation.buyer_id == buyer_id,
            MarketplaceConversation.seller_id == seller_id,
            MarketplaceConversation.listing_id == listing_id,
        )
    ).first()
    if conversation:
        messages = db.exec(
            select(Message.sender_id, Message.created_at).where(Message.conversation_id == conversation)
        ).all()
        for sender_id, created_at in messages:
            actor = "buyer" if sender_id == buyer_id else "seller"
            events.append({"timestamp": created_at, "event": "Sent message", "actor": actor})

    deal = db.exec(
        select(Deal).where(
            Deal.listing_id == listing_id, Deal.buyer_id == buyer_id, Deal.seller_id == seller_id
        )
    ).first()
    if deal:
        if deal.buyer_confirmed_at:
            events.append({"timestamp": deal.buyer_confirmed_at, "event": "Buyer marked as purchased", "actor": "buyer"})
        if deal.seller_confirmed_at:
            label = "Seller confirmed purchase" if deal.outcome == "bought" else "Seller responded"
            events.append({"timestamp": deal.seller_confirmed_at, "event": label, "actor": "seller"})

    events.sort(key=lambda e: e["timestamp"])

    return {
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "listing_id": listing_id,
        "deal_status": deal.outcome if deal else None,
        "events": [
            {
                "timestamp": e["timestamp"].isoformat(),
                "event": e["event"],
                "actor": e["actor"],
            }
            for e in events
        ],
    }
