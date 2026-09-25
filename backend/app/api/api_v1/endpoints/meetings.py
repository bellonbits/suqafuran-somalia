from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.meeting_deal import Meeting, MeetingResponse
from pydantic import BaseModel

router = APIRouter()

class MeetingRespondIn(BaseModel):
    response: MeetingResponse

@router.post("/{interaction_id}/respond", response_model=Meeting)
def respond_meeting(
    interaction_id: int,
    payload: MeetingRespondIn,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
) -> Any:
    from app.models.interaction import Interaction
    
    # Use interaction as the source of truth for the meeting session
    interaction = db.get(Interaction, interaction_id)
    if not interaction:
        # Check if it's already a meeting ID (fallback)
        meeting = db.get(Meeting, interaction_id)
        if meeting:
            if current_user.id == meeting.buyer_id:
                meeting.buyer_response = payload.response.value
            elif current_user.id == meeting.seller_id:
                meeting.seller_response = payload.response.value
            else:
                raise HTTPException(status_code=403, detail="Not authorized")
            meeting.updated_at = datetime.utcnow()
            db.add(meeting)
            db.commit()
            db.refresh(meeting)
            return meeting
        raise HTTPException(status_code=404, detail="Interaction or Meeting not found")

    # Fetch listing to get seller_id
    from app.models.listing import Listing
    listing = db.get(Listing, interaction.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Find existing meeting record or create new
    statement = select(Meeting).where(
        Meeting.listing_id == interaction.listing_id,
        Meeting.buyer_id == interaction.buyer_id,
        Meeting.seller_id == listing.owner_id
    )
    meeting = db.exec(statement).first()
    
    if not meeting:
        meeting = Meeting(
            listing_id=interaction.listing_id,
            buyer_id=interaction.buyer_id,
            seller_id=listing.owner_id,
        )
    
    # Assign response based on role
    response_val = payload.response.value if hasattr(payload.response, 'value') else payload.response
    if current_user.id == meeting.buyer_id:
        meeting.buyer_response = response_val
    elif current_user.id == meeting.seller_id:
        meeting.seller_response = response_val
    else:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this meeting")

    meeting.updated_at = datetime.utcnow()
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting
