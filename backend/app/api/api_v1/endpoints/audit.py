from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.api import deps
from app.models.audit import AuditLog
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class AuditLogRead(BaseModel):
    id: int
    user_id: int
    action: str
    resource_type: str
    resource_id: int
    details: Optional[str] = None
    timestamp: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/logs", response_model=List[AuditLogRead])
def get_audit_logs(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_agent_user),
    limit: int = Query(default=100, le=500),
    action: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
) -> Any:
    """Agent/Admin: Fetch system-wide audit logs with optional filtering."""
    statement = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if action:
        statement = statement.where(AuditLog.action == action)
    if resource_type:
        statement = statement.where(AuditLog.resource_type == resource_type)
    
    logs = db.exec(statement).all()
    
    result = []
    for log in logs:
        user = db.get(User, log.user_id)
        result.append(AuditLogRead(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            timestamp=log.timestamp,
            user_email=user.email if user else None,
            user_name=user.full_name if user else None,
        ))
    return result
