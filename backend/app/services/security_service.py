import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.device import Device, UserDeviceLink
from app.models.user import User
from app.models.fraud import FraudEvent, FraudTargetType

from prometheus_client import Counter
from app.core.logging_config import get_security_logger

logger = get_security_logger()

fraud_events_total = Counter('suqafuran_fraud_events_total', 'Total number of detected fraud events', ['rule_name', 'target_type'])
critical_risk_actions_total = Counter('suqafuran_critical_risk_actions_total', 'Total automated actions taken due to critical risk', ['target_type'])

class SecurityService:
    def get_or_create_device(self, db: Session, fingerprint: str, metadata: Dict[str, Any]) -> Device:
        device = db.query(Device).filter(Device.fingerprint_hash == fingerprint).first()
        if not device:
            device = Device(
                fingerprint_hash=fingerprint,
                device_metadata=metadata,
                is_banned=False
            )
            db.add(device)
            db.commit()
            db.refresh(device)
        else:
            # Update device if metadata changed or just update timestamp
            device.last_seen_at = datetime.utcnow()
            if metadata:
                device.device_metadata = metadata
            db.add(device)
            db.commit()
        return device

    def link_user_to_device(self, db: Session, user: User, device: Device):
        link = db.query(UserDeviceLink).filter(
            UserDeviceLink.user_id == user.id,
            UserDeviceLink.device_id == device.id
        ).first()
        
        if not link:
            link = UserDeviceLink(user_id=user.id, device_id=device.id)
            db.add(link)
            
            # CHECK FOR MULTI-ACCOUNT PATTERNS
            other_users_count = db.query(UserDeviceLink).filter(
                UserDeviceLink.device_id == device.id,
                UserDeviceLink.user_id != user.id
            ).count()
            
            if other_users_count >= 2:
                # Trigger fraud event for potential account farming
                self.record_fraud_event(
                    db,
                    FraudTargetType.DEVICE,
                    str(device.id),
                    "multi_account_link",
                    risk_score=50 + (other_users_count * 10),
                    confidence=0.9,
                    metadata={"user_ids": [user.id]}
                )
        else:
            # Just record that we've seen it (in a real app, maybe update a 'last_seen' field if it existed)
            pass
            
        db.commit()

    def record_fraud_event(
        self, 
        db: Session, 
        target_type: FraudTargetType, 
        target_id: str, 
        rule_name: str, 
        risk_score: int, 
        confidence: float, 
        metadata: Dict[str, Any]
    ):
        event = FraudEvent(
            target_type=target_type,
            target_id=target_id,
            rule_name=rule_name,
            risk_score=risk_score,
            confidence=confidence,
            event_data=metadata
        )
        db.add(event)
        
        # Increment Prometheus Metric
        fraud_events_total.labels(rule_name=rule_name, target_type=target_type.value).inc()
        
        # Log structured security event
        logger.warning(
            "fraud_event_detected",
            rule_name=rule_name,
            target_type=target_type.value,
            target_id=target_id,
            risk_score=risk_score,
            confidence=confidence,
            **(metadata or {})
        )
        
        # If risk is critical, take automated action
        if risk_score >= 90:
            critical_risk_actions_total.labels(target_type=target_type.value).inc()
            if target_type == FraudTargetType.USER:
                user = db.query(User).filter(User.id == int(target_id)).first()
                if user:
                    user.is_flagged = True
                    user.trust_score = max(0, user.trust_score - 500)
                    db.add(user)
                    
        db.commit()

security_service = SecurityService()
