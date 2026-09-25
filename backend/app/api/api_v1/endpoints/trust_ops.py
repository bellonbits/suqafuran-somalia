from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.models.fraud import FraudEvent, RiskHistory
from app.models.trust import Report
from app.models.device import Device, UserDeviceLink

router = APIRouter()

@router.get("/fraud-events", response_model=List[FraudEvent])
def read_fraud_events(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Retrieve all automated fraud detection events.
    """
    return db.query(FraudEvent).order_by(FraudEvent.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/reports", response_model=List[Report])
def read_reports(
    db: Session = Depends(deps.get_db),
    status: str = "pending",
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Retrieve community reports for moderation.
    """
    return db.query(Report).filter(Report.status == status).order_by(Report.created_at.desc()).all()

@router.get("/user-risk/{user_id}")
def get_user_risk_profile(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Get a comprehensive risk profile for a user, including linked devices and history.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    devices = db.query(Device).join(UserDeviceLink).filter(UserDeviceLink.user_id == user_id).all()
    history = db.query(RiskHistory).filter(RiskHistory.user_id == user_id).order_by(RiskHistory.created_at.desc()).all()
    
    # Find other users on these same devices
    device_ids = [d.id for d in devices]
    linked_users = db.query(User).join(UserDeviceLink).filter(
        UserDeviceLink.device_id.in_(device_ids),
        UserDeviceLink.user_id != user_id
    ).all()

    return {
        "user_trust_score": user.trust_score,
        "trust_level": user.trust_level,
        "is_flagged": user.is_flagged,
        "devices": devices,
        "linked_users": linked_users,
        "risk_history": history
    }

@router.post("/moderate-report/{report_id}")
def moderate_report(
    report_id: int,
    action: str, # dismiss, warn, ban, remove_listing
    note: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_admin),
) -> Any:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = action
    report.admin_note = note
    report.admin_action = action
    
    if action == "ban":
        user = db.query(User).filter(User.id == report.reported_user_id).first()
        if user:
            user.is_suspended = True
            db.add(user)
            
    db.add(report)
    db.commit()
    return {"status": "success"}
