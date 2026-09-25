import asyncio
import logging
import uuid as uuid_pkg
from datetime import datetime, timedelta
from typing import Any, List, Dict, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
    Query
)
from jose import jwt
from sqlmodel import Session, select, func
import redis

from app.api.deps import get_db, get_current_active_user
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.models.business import (
    Business,
    Employee,
    BusinessProduct,
    BusinessCustomer,
    BusinessOrder,
    BusinessMessage,
    TeamMessage,
    BusinessTask,
    BusinessRole
)
from app.models.listing import Listing
from app.crud.crud_business import crud_business
from app.services.kafka_service import ws_manager, kafka_service
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Try initializing Redis Client for fast analytics cache
try:
    from app.utils.redis import from_url_safe
    redis_client = from_url_safe(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.warning(f"Failed to connect to Redis for analytics caching: {e}")
    redis_client = None


# --- RBAC Helper Dependency ---
def check_business_role(roles_allowed: List[BusinessRole]):
    async def dependency(
        business_id: uuid_pkg.UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ) -> Employee:
        business = crud_business.get_business(db, business_id)
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        # Owners bypass all checks
        if business.owner_id == current_user.id:
            membership = crud_business.get_employee_by_user(db, business_id, current_user.id)
            if not membership:
                membership = Employee(
                    business_id=business_id,
                    user_id=current_user.id,
                    role=BusinessRole.OWNER,
                    is_active=True
                )
            return membership

        membership = crud_business.get_employee_by_user(db, business_id, current_user.id)
        if not membership:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You are not an employee of this business workspace"
            )

        if not membership.is_active:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Your employee profile is deactivated"
            )

        if roles_allowed and membership.role not in roles_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Require roles {[r.value for r in roles_allowed]}"
            )

        return membership
    return dependency


RequireOwner = Depends(check_business_role([BusinessRole.OWNER]))
RequireAdmin = Depends(check_business_role([BusinessRole.OWNER, BusinessRole.ADMIN]))
RequireManager = Depends(check_business_role([BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.MANAGER]))
RequireEmployee = Depends(check_business_role([]))  # Any active employee


# --- Workspace Routes ---
@router.post("/", response_model=Business)
def register_business(
    *,
    db: Session = Depends(get_db),
    name: str,
    slug: str,
    category: str,
    description: Optional[str] = None,
    address: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    location_lat: Optional[float] = None,
    location_lng: Optional[float] = None,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Register a new SaaS business workspace."""
    existing = crud_business.get_business_by_slug(db, slug)
    if existing:
        raise HTTPException(status_code=400, detail="Slug already in use")

    return crud_business.create_business(
        db,
        owner_id=current_user.id,
        name=name,
        slug=slug,
        category=category,
        description=description,
        address=address,
        phone=phone,
        email=email,
        location_lat=location_lat,
        location_lng=location_lng
    )


@router.get("/my-businesses", response_model=List[Business])
def list_my_businesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Get all business workspaces owned by or employing the user."""
    return crud_business.list_user_businesses(db, current_user.id)


@router.get("/public/{slug}")
def get_public_business(
    slug: str,
    db: Session = Depends(get_db)
) -> Any:
    """Get public profile details of a business, its products, and owner's listings."""
    business = crud_business.get_business_by_slug(db, slug)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Fetch active in-store products for this business
    products_stmt = select(BusinessProduct).where(
        BusinessProduct.business_id == business.id,
        BusinessProduct.is_active == True
    )
    products = db.exec(products_stmt).all()

    # Also fetch the owner's active marketplace listings (ads)
    listings_stmt = select(Listing).where(
        Listing.owner_id == business.owner_id,
        Listing.status == "active"
    ).order_by(Listing.created_at.desc())
    listings = db.exec(listings_stmt).all()

    # Include owner avatar so the storefront can fall back to it when no logo is set
    owner = db.get(User, business.owner_id)
    owner_avatar_url = owner.avatar_url if owner else None

    return {
        "business": business,
        "products": products,
        "listings": [l.model_dump() for l in listings],
        "owner_avatar_url": owner_avatar_url,
    }


@router.get("/nearby")
def get_nearby_businesses(
    db: Session = Depends(get_db),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(20),
    offset: int = Query(0)
) -> Any:
    """List all active businesses, optionally sorted by distance/proximity if coordinates are provided."""
    stmt = select(Business).where(
        Business.is_active == True,
        Business.show_in_nearby == True,
        Business.is_approved == True
    )
    if category:
        stmt = stmt.where(Business.category == category)
        
    businesses = db.exec(stmt).all()
    
    result = []
    for b in businesses:
        dist = None
        if lat is not None and lng is not None and b.location_lat is not None and b.location_lng is not None:
            from math import radians, cos, sin, asin, sqrt
            lat1, lng1, lat2, lng2 = map(radians, [lat, lng, b.location_lat, b.location_lng])
            dlon = lng2 - lng1 
            dlat = lat2 - lat1 
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a)) 
            dist = c * 6371  # km
            
        result.append({
            "id": str(b.id),
            "owner_id": b.owner_id,
            "name": b.name,
            "slug": b.slug,
            "logo_url": b.logo_url,
            "banner_url": b.banner_url,
            "description": b.description,
            "category": b.category,
            "location_lat": b.location_lat,
            "location_lng": b.location_lng,
            "address": b.address,
            "phone": b.phone,
            "email": b.email,
            "website": b.website,
            "is_verified": b.is_verified,
            "rating": b.rating,
            "trust_score": b.trust_score,
            "brand_color": b.brand_color,
            "tagline": b.tagline,
            "distance_km": dist
        })
        
    if lat is not None and lng is not None:
        result.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"]))
        
    return result[offset : offset + limit]


@router.get("/{business_id}", response_model=Business)
def get_business_details(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Fetch profile of a business."""
    business = crud_business.get_business(db, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@router.put("/{business_id}", response_model=Business)
def update_business_profile(
    business_id: uuid_pkg.UUID,
    *,
    db: Session = Depends(get_db),
    update_data: dict,
    _member: Employee = RequireAdmin
) -> Any:
    """Update profile and settings of a business workspace."""
    business = crud_business.get_business(db, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Exclude immutable parameters
    for field in ["id", "owner_id", "slug", "created_at", "is_approved"]:
        update_data.pop(field, None)

    return crud_business.update_business(db, business, update_data)


# --- Employee Roster & Invites ---
@router.get("/{business_id}/employees", response_model=List[Employee])
def get_business_employees(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireManager
) -> Any:
    """List all employees/invites for this business workspace."""
    return crud_business.list_employees(db, business_id)


@router.post("/{business_id}/employees/invite", response_model=Employee)
def invite_business_employee(
    business_id: uuid_pkg.UUID,
    *,
    db: Session = Depends(get_db),
    email: Optional[str] = None,
    phone: Optional[str] = None,
    role: BusinessRole,
    _member: Employee = RequireAdmin
) -> Any:
    """Invite an employee to the workspace."""
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Must provide email or phone for invite")
    return crud_business.invite_employee(db, business_id, email, phone, role)


@router.put("/{business_id}/employees/{employee_id}", response_model=Employee)
def update_employee_membership(
    business_id: uuid_pkg.UUID,
    employee_id: int,
    *,
    db: Session = Depends(get_db),
    role: Optional[BusinessRole] = None,
    is_active: Optional[bool] = None,
    _member: Employee = RequireAdmin
) -> Any:
    """Update role or active status of a membership."""
    employee = crud_business.get_employee(db, employee_id)
    if not employee or employee.business_id != business_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    if employee.role == BusinessRole.OWNER and is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate the business owner")

    update_data = {}
    if role:
        update_data["role"] = role
    if is_active is not None:
        update_data["is_active"] = is_active

    for field, value in update_data.items():
        setattr(employee, field, value)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


# --- Inventory & Product management ---
@router.get("/{business_id}/products", response_model=List[BusinessProduct])
def list_business_inventory(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """List business inventory catalog."""
    return crud_business.list_products(db, business_id)


@router.post("/{business_id}/products", response_model=BusinessProduct)
def add_business_product(
    business_id: uuid_pkg.UUID,
    *,
    db: Session = Depends(get_db),
    name_en: str,
    price: float,
    name_so: Optional[str] = None,
    description_en: Optional[str] = None,
    description_so: Optional[str] = None,
    sku: Optional[str] = None,
    stock_level: int = 0,
    low_stock_threshold: int = 5,
    category_id: Optional[int] = None,
    subcategory_id: Optional[int] = None,
    images: List[str] = [],
    variants: dict = {},
    _member: Employee = RequireManager
) -> Any:
    """Add a product item to the business catalog."""
    return crud_business.create_product(
        db,
        business_id,
        name_en=name_en,
        price=price,
        name_so=name_so,
        description_en=description_en,
        description_so=description_so,
        sku=sku,
        stock_level=stock_level,
        low_stock_threshold=low_stock_threshold,
        category_id=category_id,
        subcategory_id=subcategory_id,
        images=images,
        variants=variants
    )


@router.put("/{business_id}/products/{product_id}", response_model=BusinessProduct)
def update_business_product_details(
    business_id: uuid_pkg.UUID,
    product_id: int,
    *,
    db: Session = Depends(get_db),
    update_data: dict,
    _member: Employee = RequireManager
) -> Any:
    """Update catalog product detail / inventory adjustment."""
    product = crud_business.get_product(db, product_id)
    if not product or product.business_id != business_id:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data.pop("id", None)
    update_data.pop("business_id", None)

    return crud_business.update_product(db, product, update_data)


# --- Order Processing ---
@router.get("/{business_id}/orders", response_model=List[BusinessOrder])
def list_business_orders(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """List workspace order history."""
    return crud_business.list_orders(db, business_id)


@router.post("/{business_id}/orders", response_model=BusinessOrder)
def record_order_entry(
    business_id: uuid_pkg.UUID,
    *,
    db: Session = Depends(get_db),
    customer_id: int,
    items: List[dict],
    total_amount: float,
    payment_method: str = "cash",
    notes: Optional[str] = None,
    employee_id: Optional[int] = None,
    _member: Employee = RequireEmployee
) -> Any:
    """Record a manual customer purchase order."""
    return crud_business.create_order(
        db,
        business_id,
        customer_id=customer_id,
        items=items,
        total_amount=total_amount,
        payment_method=payment_method,
        notes=notes,
        employee_id=employee_id
    )


@router.put("/{business_id}/orders/{order_id}", response_model=BusinessOrder)
def change_order_status(
    business_id: uuid_pkg.UUID,
    order_id: int,
    *,
    db: Session = Depends(get_db),
    status: str,
    employee_id: Optional[int] = None,
    _member: Employee = RequireEmployee
) -> Any:
    """Update status/resolution of an order."""
    order = crud_business.get_order(db, order_id)
    if not order or order.business_id != business_id:
        raise HTTPException(status_code=404, detail="Order not found")

    return crud_business.update_order_status(db, order, status, employee_id)


@router.get("/{business_id}/orders/{order_id}/view", response_model=BusinessOrder)
def view_order(
    business_id: uuid_pkg.UUID,
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Read a single order — open to the buyer who placed it OR an employee of
    the selling business (unlike the list/update endpoints above, which are
    seller-only). This is what the customer-facing order tracking page polls
    and uses for its initial load before the WebSocket takes over.
    """
    order = crud_business.get_order(db, order_id)
    if not order or order.business_id != business_id:
        raise HTTPException(status_code=404, detail="Order not found")

    is_buyer = order.customer_id == current_user.id
    is_seller_side = crud_business.get_employee_by_user(db, business_id, current_user.id) is not None
    if not is_buyer and not is_seller_side:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")

    return order


# --- CRM Customer Management ---
@router.get("/{business_id}/customers", response_model=List[BusinessCustomer])
def get_crm_customers(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """List CRM registered business customer profiles."""
    return crud_business.list_customers(db, business_id)


@router.put("/{business_id}/customers/{customer_id}", response_model=BusinessCustomer)
def update_crm_customer_record(
    business_id: uuid_pkg.UUID,
    customer_id: int,
    *,
    db: Session = Depends(get_db),
    notes: str,
    _member: Employee = RequireEmployee
) -> Any:
    """Update notes/history regarding customer relationship profiles."""
    cust = db.get(BusinessCustomer, customer_id)
    if not cust or cust.business_id != business_id:
        raise HTTPException(status_code=404, detail="Customer log not found")
    return crud_business.update_customer_notes(db, cust, notes)


# --- Team Task Items ---
@router.get("/{business_id}/tasks", response_model=List[BusinessTask])
def list_workspace_tasks(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Get all workspace Kanban team tasks."""
    return crud_business.list_tasks(db, business_id)


@router.post("/{business_id}/tasks", response_model=BusinessTask)
def create_team_task(
    business_id: uuid_pkg.UUID,
    *,
    db: Session = Depends(get_db),
    title: str,
    description: Optional[str] = None,
    status: str = "todo",
    assigned_to: Optional[int] = None,
    order_id: Optional[int] = None,
    due_date: Optional[datetime] = None,
    _member: Employee = RequireEmployee
) -> Any:
    """Create a workspace team task."""
    return crud_business.create_task(
        db,
        business_id,
        title=title,
        description=description,
        status=status,
        assigned_to=assigned_to,
        order_id=order_id,
        due_date=due_date
    )


@router.put("/{business_id}/tasks/{task_id}", response_model=BusinessTask)
def update_team_task_state(
    business_id: uuid_pkg.UUID,
    task_id: int,
    *,
    db: Session = Depends(get_db),
    update_data: dict,
    _member: Employee = RequireEmployee
) -> Any:
    """Modify task detail / change column category."""
    task = crud_business.get_task(db, task_id)
    if not task or task.business_id != business_id:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data.pop("id", None)
    update_data.pop("business_id", None)

    return crud_business.update_task(db, task, update_data)


# --- Messaging REST History ---
@router.get("/{business_id}/messages/customer/{customer_id}", response_model=List[BusinessMessage])
def list_customer_chat_history(
    business_id: uuid_pkg.UUID,
    customer_id: int,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """List messaging logs for customer communications."""
    return crud_business.list_customer_messages(db, business_id, customer_id)


@router.post("/{business_id}/messages/customer/{customer_id}", response_model=BusinessMessage)
def send_customer_chat_message(
    business_id: uuid_pkg.UUID,
    customer_id: int,
    *,
    db: Session = Depends(get_db),
    content: str,
    tags: List[str] = [],
    _member: Employee = RequireEmployee
) -> Any:
    """Send and register a message from the business to the customer."""
    return crud_business.create_business_message(
        db,
        business_id,
        customer_id=customer_id,
        sender_id=_member.user_id or _member.id,
        content=content,
        is_from_customer=False,
        tags=tags
    )


@router.get("/{business_id}/messages/team", response_model=List[TeamMessage])
def list_team_chat_history(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """List internal team discussion messages."""
    return crud_business.list_team_messages(db, business_id)


@router.post("/{business_id}/messages/team", response_model=TeamMessage)
def send_team_chat_message(
    business_id: uuid_pkg.UUID,
    *,
    db: Session = Depends(get_db),
    content: str,
    is_announcement: bool = False,
    order_id: Optional[int] = None,
    _member: Employee = RequireEmployee
) -> Any:
    """Send an internal team announcement or query message."""
    return crud_business.create_team_message(
        db,
        business_id,
        sender_id=_member.user_id or _member.id,
        content=content,
        is_announcement=is_announcement,
        order_id=order_id
    )


# --- Analytics cached endpoint ---
@router.get("/{business_id}/analytics")
def get_dashboard_analytics(
    business_id: uuid_pkg.UUID,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Get workspace key metric graphs (cached in Redis, recalculated on miss)."""
    cache_key = f"business_analytics_{business_id}"
    
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                import json
                return json.loads(cached_data)
        except Exception:
            pass

    # Recalculate metrics manually
    # 1. Total Revenue & order counts
    order_stmt = select(
        func.sum(BusinessOrder.total_amount),
        func.count(BusinessOrder.id)
    ).where(
        BusinessOrder.business_id == business_id,
        BusinessOrder.status == "completed"
    )
    revenue, completed_orders = db.exec(order_stmt).first()
    revenue = float(revenue or 0.0)

    # 2. Total active products count
    prod_stmt = select(func.count(BusinessProduct.id)).where(
        BusinessProduct.business_id == business_id,
        BusinessProduct.is_active == True
    )
    product_count = db.exec(prod_stmt).one()

    # 3. CRM totals
    cust_stmt = select(func.count(BusinessCustomer.id)).where(
        BusinessCustomer.business_id == business_id
    )
    customer_count = db.exec(cust_stmt).one()

    # 4. Low stock count
    low_stock_stmt = select(func.count(BusinessProduct.id)).where(
        BusinessProduct.business_id == business_id,
        BusinessProduct.stock_level <= BusinessProduct.low_stock_threshold,
        BusinessProduct.is_active == True
    )
    low_stock_count = db.exec(low_stock_stmt).one()

    # 5. Sales trends last 7 days
    date_seven_days_ago = datetime.utcnow() - timedelta(days=7)
    trend_stmt = select(
        func.date_trunc('day', BusinessOrder.created_at).label('day'),
        func.sum(BusinessOrder.total_amount).label('total')
    ).where(
        BusinessOrder.business_id == business_id,
        BusinessOrder.status == "completed",
        BusinessOrder.created_at >= date_seven_days_ago
    ).group_by('day').order_by('day')
    
    trends = []
    for day, total in db.exec(trend_stmt).all():
        trends.append({
            "date": day.strftime("%Y-%m-%d") if day else "",
            "revenue": float(total or 0.0)
        })

    analytics_payload = {
        "revenue": revenue,
        "completed_orders": completed_orders,
        "product_count": product_count,
        "customer_count": customer_count,
        "low_stock_count": low_stock_count,
        "sales_trends_7d": trends
    }

    if redis_client:
        try:
            import json
            redis_client.setex(cache_key, 300, json.dumps(analytics_payload))  # 5 min TTL
        except Exception:
            pass

    return analytics_payload


# --- Groq AI Workspace Helper Endpoints ---
class AIDescriptionRequest(dict):
    pass

@router.post("/{business_id}/ai/generate-description")
def ai_generate_description(
    business_id: uuid_pkg.UUID,
    *,
    input_text: str,
    target_language: str = "en",
    category: Optional[str] = None,
    attributes: dict = {},
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Generate high-quality product description using Groq AI."""
    desc = ai_service.generate_listing_text(
        type="description",
        input_text=input_text,
        target_language=target_language,
        category=category,
        attributes=attributes
    )
    return {"description": desc}


@router.post("/{business_id}/ai/suggest-price")
def ai_suggest_price(
    business_id: uuid_pkg.UUID,
    *,
    title: str,
    category: str,
    condition: str = "Used",
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Suggest price range using Groq AI comparison matching."""
    listing_data = {
        "title_en": title,
        "category": category,
        "condition": condition,
        "currency": "USD"
    }
    return ai_service.get_price_recommendation(listing_data)


@router.post("/{business_id}/ai/suggest-reply")
def ai_suggest_reply(
    business_id: uuid_pkg.UUID,
    *,
    customer_id: int,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Suggest chat replies for messaging threads with a customer."""
    messages = crud_business.list_customer_messages(db, business_id, customer_id)
    chat_list = []
    for msg in messages[-5:]:
        role = "buyer" if msg.is_from_customer else "seller"
        chat_list.append({"role": role, "content": msg.content})
    
    if not chat_list:
        chat_list.append({"role": "buyer", "content": "Hi, I am interested in your products."})

    return ai_service.generate_chat_suggestions(chat_list, role="seller")


@router.post("/{business_id}/ai/summarize-chat")
def ai_summarize_chat(
    business_id: uuid_pkg.UUID,
    *,
    customer_id: int,
    db: Session = Depends(get_db),
    _member: Employee = RequireEmployee
) -> Any:
    """Summarize customer conversation logs using Groq AI."""
    messages = crud_business.list_customer_messages(db, business_id, customer_id)
    if not messages:
        return {"summary": "No messages found to summarize."}

    history_text = "\n".join([
        f"{'Customer' if m.is_from_customer else 'Business'}: {m.content}"
        for m in messages[-20:]
    ])

    system_prompt = "You are a professional business assistant. Summarize this customer messaging log. Keep it under 3 sentences focusing on customer needs and status."
    user_prompt = f"Chat Log:\n{history_text}"

    summary = ai_service._call_ai(system_prompt, user_prompt)
    return {"summary": summary}


# --- Multiplexing WebSocket Handler ---
@router.websocket("/{business_id}/chat/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    business_id: uuid_pkg.UUID
):
    """
    WebSocket workspace endpoint. 
    Accepts real-time events and routes them to active employees.
    """
    # Try retrieving token from query parameters (since HTTP headers aren't available easily in JS WebSocket API)
    token = websocket.query_params.get("token")
    if not token:
        # Check if auth payload is transmitted in first message, or fall back to connection close
        logger.warning(f"No auth token provided in query params for business WS {business_id}.")
    
    # Establish connection
    await ws_manager.connect(str(business_id), websocket)
    
    # Set running loop for thread-safe cross-thread execution
    if ws_manager.loop is None:
        ws_manager.set_event_loop(asyncio.get_event_loop())

    try:
        while True:
            # We block waiting for input from the client
            # Format: {"type": "chat_message" | "team_announcement", "token": "JWT", "payload": {...}}
            data = await websocket.receive_json()
            event_type = data.get("type")
            payload = data.get("payload", {})
            auth_token = data.get("token") or token
            
            # Auth Check
            if not auth_token:
                await websocket.send_json({"error": "Unauthorized: Token missing"})
                continue
                
            try:
                jwt_payload = jwt.decode(
                    auth_token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
                )
                user_id = jwt_payload.get("sub")
            except Exception:
                await websocket.send_json({"error": "Unauthorized: Invalid JWT credentials"})
                continue

            # Run in a synchronous context database session
            with DbSessionLocal() as db:
                # Confirm user is employee/owner of this business
                member = crud_business.get_employee_by_user(db, business_id, int(user_id))
                if not member or not member.is_active:
                    await websocket.send_json({"error": "Forbidden: You are not authorized on this business"})
                    continue

                if event_type == "customer_message":
                    # Record message and broadcast to Kafka (consumer will broadcast to socket connections)
                    cust_id = payload.get("customer_id")
                    content = payload.get("content")
                    if cust_id and content:
                        crud_business.create_business_message(
                            db,
                            business_id,
                            customer_id=int(cust_id),
                            sender_id=int(user_id),
                            content=content,
                            is_from_customer=False,
                            tags=payload.get("tags", [])
                        )

                elif event_type == "team_message":
                    content = payload.get("content")
                    if content:
                        crud_business.create_team_message(
                            db,
                            business_id,
                            sender_id=int(user_id),
                            content=content,
                            is_announcement=payload.get("is_announcement", False),
                            order_id=payload.get("order_id")
                        )

    except WebSocketDisconnect:
        ws_manager.disconnect(str(business_id), websocket)
    except Exception as e:
        logger.error(f"WebSocket execution error: {e}")
        ws_manager.disconnect(str(business_id), websocket)


# Simple fallback definition for db sessions inside websocket loop
def DbSessionLocal():
    from app.db.session import SessionLocal
    return SessionLocal()
