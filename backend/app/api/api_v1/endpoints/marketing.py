"""Marketing automation endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.marketing import EmailPreference, SavedSearch, UserLifecycleStage
from app.services.marketing_service import marketing_service
from app.core.logging_config import get_logger

logger = get_logger("marketing_api")

router = APIRouter(prefix="/marketing", tags=["marketing"])


@router.get("/email-preferences")
async def get_email_preferences(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get user's email preferences."""
    preference = session.query(EmailPreference).filter(
        EmailPreference.user_id == current_user.id
    ).first()
    
    if not preference:
        # Create default preferences
        preference = EmailPreference(user_id=current_user.id)
        session.add(preference)
        session.commit()
    
    return preference


@router.put("/email-preferences")
async def update_email_preferences(
    data: dict,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Update user's email preferences."""
    preference = session.query(EmailPreference).filter(
        EmailPreference.user_id == current_user.id
    ).first()
    
    if not preference:
        preference = EmailPreference(user_id=current_user.id)
        session.add(preference)
    
    # Update fields
    for key, value in data.items():
        if hasattr(preference, key):
            setattr(preference, key, value)
    
    session.add(preference)
    session.commit()
    
    return {"status": "preferences updated"}


@router.post("/saved-search")
async def create_saved_search(
    data: dict,  # { "search_query": "iPhone", "category_id": 1, "min_price": 10000, "max_price": 50000 }
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Save a search for future email alerts."""
    saved_search = SavedSearch(
        user_id=current_user.id,
        search_query=data.get("search_query"),
        category_id=data.get("category_id"),
        min_price=data.get("min_price"),
        max_price=data.get("max_price"),
        location=data.get("location"),
    )
    session.add(saved_search)
    session.commit()
    
    logger.info(f"User {current_user.id} saved search: {data.get('search_query')}")
    
    return {"id": saved_search.id, "status": "saved"}


@router.get("/saved-searches")
async def get_saved_searches(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get user's saved searches."""
    searches = session.query(SavedSearch).filter(
        SavedSearch.user_id == current_user.id
    ).all()
    
    return searches


@router.delete("/saved-search/{search_id}")
async def delete_saved_search(
    search_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete a saved search."""
    search = session.query(SavedSearch).filter(
        SavedSearch.id == search_id,
        SavedSearch.user_id == current_user.id
    ).first()
    
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    session.delete(search)
    session.commit()
    
    return {"status": "deleted"}


@router.get("/user-lifecycle")
async def get_user_lifecycle(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get user's lifecycle stage and stats."""
    lifecycle = session.query(UserLifecycleStage).filter(
        UserLifecycleStage.user_id == current_user.id
    ).first()
    
    if not lifecycle:
        return {"stage": "signup", "days_since_signup": 0}
    
    return lifecycle
