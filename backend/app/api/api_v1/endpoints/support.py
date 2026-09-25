from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func
from app.api import deps
from app.models.support import SupportTicket, SupportTicketUpdate, SupportTicketCreate
from app.models.user import User

router = APIRouter()

class TicketReplyIn(BaseModel):
    message: str

@router.get("/my-active-ticket", response_model=Optional[SupportTicket])
def read_my_active_ticket(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Retrieve the current user's active support ticket."""
    query = select(SupportTicket).where(
        SupportTicket.user_id == current_user.id
    ).order_by(SupportTicket.created_at.desc())
    ticket = db.exec(query).first()
    return ticket

@router.get("/ticket-by-id/{ticket_id}", response_model=SupportTicket)
def read_ticket_by_id(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    x_ticket_token: Optional[str] = Header(default=None),
):
    """
    Guest lookup of their own ticket. Requires the X-Ticket-Token header
    returned when the ticket was created; ids are sequential, so the id alone
    would expose every customer's chat. Wrong/missing token -> 404, so ticket
    existence isn't revealed either.
    """
    import hmac
    ticket = db.get(SupportTicket, ticket_id)
    if (
        not ticket
        or not ticket.guest_token
        or not x_ticket_token
        or not hmac.compare_digest(ticket.guest_token, x_ticket_token)
    ):
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.get("/tickets", response_model=List[SupportTicket])
def read_tickets(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_agent),
):
    """Retrieve support tickets (Agent and Admin)."""
    query = select(SupportTicket)
    if status:
        query = query.where(SupportTicket.status == status)
    
    tickets = db.exec(query.offset(skip).limit(limit)).all()
    return tickets

@router.get("/tickets/{ticket_id}", response_model=SupportTicket)
def read_ticket(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_agent),
):
    """Get ticket details (Agent and Admin)."""
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.patch("/tickets/{ticket_id}", response_model=SupportTicket)
def update_ticket(
    ticket_id: int,
    ticket_in: SupportTicketUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_agent),
):
    """Update ticket status or notes (Agent and Admin)."""
    db_ticket = db.get(SupportTicket, ticket_id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = ticket_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ticket, key, value)
    
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@router.post("/tickets/{ticket_id}/reply", response_model=SupportTicket)
def reply_to_ticket(
    ticket_id: int,
    payload: TicketReplyIn,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_agent),
):
    """Send a manual agent reply, appending it to the ticket's chat history."""
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    history = list(ticket.chat_history or [])
    history.append({
        "role": "assistant",
        "content": payload.message,
        "timestamp": datetime.utcnow().isoformat()
    })
    ticket.chat_history = history
    ticket.last_agent_response = payload.message
    ticket.status = "pending"  # Mark as pending action/reply from user
    ticket.updated_at = datetime.utcnow()
    
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.delete("/tickets/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_agent),
):
    """Delete a ticket (Agent and Admin)."""
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return {"status": "success"}

@router.get("/stats")
def support_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_agent),
):
    """Get support stats (Agent and Admin)."""
    total = db.exec(select(func.count(SupportTicket.id))).one()
    open_tickets = db.exec(select(func.count(SupportTicket.id)).where(SupportTicket.status == "open")).one()
    return {
        "total": total,
        "open": open_tickets,
        "resolved": total - open_tickets
    }
