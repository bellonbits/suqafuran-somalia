from fastapi import APIRouter, Depends, Request
from sqlmodel import Session
from pydantic import BaseModel
from typing import Optional, List, Any
from app.api import deps
from app.services.ai_service import ai_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


# ─── Request/Response Models ──────────────────────────────────────────────────

class GenerateListingRequest(BaseModel):
    title: str
    category: Optional[str] = None
    attributes: Optional[dict] = None
    target_language: Optional[str] = "en"
    type: Optional[str] = "description"   # "title" | "description" | "translate"

class ModerationRequest(BaseModel):
    text: str
    image_urls: Optional[List[str]] = []

class ParseSearchRequest(BaseModel):
    query: str

class PriceRecommendationRequest(BaseModel):
    title: str
    category_id: Optional[int] = None
    condition: Optional[str] = "Used"
    currency: Optional[str] = "KES"

class PredictCategoryRequest(BaseModel):
    title: str
    description: Optional[str] = ""

class ChatSuggestionsRequest(BaseModel):
    conversation_id: Optional[int] = None
    messages: Optional[List[dict]] = []
    role: Optional[str] = "buyer"

class ParseListingRequest(BaseModel):
    text: str

class RecommendationsRequest(BaseModel):
    category_id: Optional[int] = None
    limit: Optional[int] = 10
    user_history: Optional[List[Any]] = []

class DemandInsightsRequest(BaseModel):
    category_id: Optional[int] = None
    location: Optional[str] = "Nairobi"

class SupportChatRequest(BaseModel):
    messages: List[dict]
    current_listing_id: Optional[int] = None
    user_history: Optional[List[int]] = []
    ticket_id: Optional[int] = None
    # Guest ticket secret returned on the first reply; required to continue it.
    ticket_token: Optional[str] = None
    # UI language of the site ('so' or 'en'); the agent replies in it.
    language: Optional[str] = "so"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/listings/generate")
def generate_listing_text(body: GenerateListingRequest):
    """Generate AI-enhanced listing title or description."""
    result = ai_service.generate_listing_text(
        type=body.type,
        input_text=body.title,
        target_language=body.target_language,
        category=body.category,
        attributes=body.attributes,
    )
    return {"result": result}


@router.post("/moderation/check")
def check_moderation(body: ModerationRequest):
    """Check listing text for scam, fraud or inappropriate content."""
    listing_data = {"title_en": body.text, "description_en": body.text}
    result = ai_service.check_moderation(listing_data)
    return result


@router.post("/search/parse")
def parse_search(body: ParseSearchRequest):
    """Convert natural language query into structured search filters."""
    result = ai_service.parse_search_query(body.query)
    return result


@router.post("/listings/price-recommendation")
def price_recommendation(body: PriceRecommendationRequest):
    """Return a suggested price range for a listing."""
    listing_data = {
        "title_en": body.title,
        "category": body.category_id,
        "condition": body.condition,
        "currency": body.currency,
    }
    result = ai_service.get_price_recommendation(listing_data)
    return result


@router.post("/listings/predict-category")
def predict_category(body: PredictCategoryRequest):
    """Predict the best category for a listing."""
    result = ai_service.predict_category(body.title, body.description)
    return result


@router.post("/chat/suggestions")
def chat_suggestions(body: ChatSuggestionsRequest):
    """Generate smart reply suggestions for a chat conversation."""
    result = ai_service.generate_chat_suggestions(
        messages=body.messages,
        role=body.role,
    )
    return result


@router.get("/seller/score/{user_id}")
def seller_score(user_id: int, db: Session = Depends(deps.get_db)):
    """Calculate and return a trust/seller score for a user."""
    from sqlmodel import select
    from app.models.user import User as UserModel
    try:
        user_row = db.exec(select(UserModel).where(UserModel.id == user_id)).first()
        user_data = {
            "id": user_id,
            "full_name": user_row.full_name if user_row else "Unknown",
            "created_at": str(user_row.created_at) if user_row and user_row.created_at else "Unknown",
            "is_verified": user_row.is_verified if user_row else False,
        }
        result = ai_service.calculate_seller_score(user_data=user_data, history=[])
        return result
    except Exception:
        return {"score": 50, "level": "New", "badges": [], "summary": "Score unavailable"}


@router.post("/insights/demand")
def demand_insights(body: DemandInsightsRequest):
    """Get market demand insights for a category/location."""
    result = ai_service.get_demand_insights(
        location=body.location or "Nairobi",
        category=str(body.category_id) if body.category_id else "General",
    )
    return result


@router.post("/listings/parse")
def parse_listing(
    body: ParseListingRequest,
    db: Session = Depends(deps.get_db),
):
    """
    10-Second Listing: convert raw text (e.g. 'iPhone 12 50k Nairobi')
    into a structured listing object ready to prefill the form.
    """
    from sqlmodel import select
    from app.models.listing import Category
    
    result = ai_service.parse_listing(body.text)
    
    # Resolve category slug to ID
    category_id = None
    if result.get("category_slug"):
        cat = db.exec(select(Category).where(Category.slug == result.get("category_slug"))).first()
        if cat:
            category_id = cat.id
            
    title = result.get("title", body.text)
    
    return {
        "title_en": title,
        "title_so": result.get("title_so", title),
        "suggestions": result.get("suggestions", [title]),
        "description_en": result.get("description", f"Selling: {title}. Contact me for more details."),
        "description_so": result.get("description_so", f"Waan iibinayaa: {title}. Ila soo xiriir."),
        "price": result.get("price"),
        "currency": result.get("currency", "USD"),
        "condition": result.get("condition", "Used"),
        "location": result.get("location"),
        "category_id": category_id,
        "is_negotiable": result.get("negotiable") == "yes"
    }


@router.post("/recommendations")
def get_recommendations(body: RecommendationsRequest):
    """Get personalized listing recommendations."""
    result = ai_service.get_recommended_listings(
        user_history=body.user_history or [],
    )
    return result


@router.post("/support/chat")
@deps.limiter.limit("20/minute")  # each message is a paid AI call
def support_chat(
    request: Request,
    body: SupportChatRequest,
    db: Session = Depends(deps.get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
):
    """AI Support Agent for the marketplace."""
    needs_agent = False
    try:
        result = ai_service.get_support_response(
            messages=body.messages,
            db=db,
            current_listing_id=body.current_listing_id,
            language=body.language or "so",
        )
    except Exception as e:
        import logging
        logging.error(f"Support response failed, forwarding to agent: {e}")
        needs_agent = True
        result = {
            "answer": (
                "Waxaan kugu xiraynaa mid ka mid ah kooxdayada taageerada. Qof ka mid ah ayaa halkan kaaga jawaabi doona dhawaan!"
                if (body.language or "so") == "so"
                else "Our platform support is currently connecting you to an active agent. A member of our team will reply to you here shortly!"
            ),
            "needs_ticket": True,
            "ticket_subject": body.messages[-1].get("content")[:50] if body.messages else "Support Request",
            "ticket_priority": "high"
        }
    
    # If the AI thinks a ticket is needed, or if we want to log all support chats
    if result.get("needs_ticket") or True: # Logging all for follow-up
        from app.models.support import SupportTicket
        from sqlmodel import select
        from datetime import datetime
        
        user_id = current_user.id if current_user else None
        
        # Check if there's an open ticket to append to
        ticket = None
        if user_id:
            ticket = db.exec(
                select(SupportTicket)
                .where(SupportTicket.user_id == user_id)
                .where(SupportTicket.status != "resolved")
            ).first()
        elif body.ticket_id and body.ticket_token:
            # Guests can only continue a ticket they hold the token for;
            # otherwise anyone could overwrite another person's chat by id.
            import hmac
            candidate = db.exec(
                select(SupportTicket)
                .where(SupportTicket.id == body.ticket_id)
                .where(SupportTicket.user_id == None)  # noqa: E711
                .where(SupportTicket.status != "resolved")
            ).first()
            if candidate and candidate.guest_token and hmac.compare_digest(candidate.guest_token, body.ticket_token):
                ticket = candidate
            
        # We must append the new user message AND the AI's response to the ticket history
        ai_response_msg = {
            "role": "assistant",
            "content": result.get("answer"),
            "timestamp": datetime.utcnow().isoformat(),
            "recommendations": result.get("recommendations", [])
        }
        
        full_chat_history = list(body.messages)
        full_chat_history.append(ai_response_msg)
            
        if not ticket:
            import secrets
            ticket = SupportTicket(
                user_id=user_id,
                subject=result.get("ticket_subject", "Support Inquiry"),
                priority=result.get("ticket_priority", "low"),
                chat_history=full_chat_history,
                last_agent_response=result.get("answer"),
                guest_token=None if user_id else secrets.token_urlsafe(32),
            )
        else:
            ticket.chat_history = full_chat_history
            ticket.last_agent_response = result.get("answer")
            
        if needs_agent:
            ticket.status = "open"
            
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        result["ticket_id"] = ticket.id
        if not user_id:
            result["ticket_token"] = ticket.guest_token
        
    return result
