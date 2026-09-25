import re
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.fraud import FraudEvent, FraudTargetType
from app.services.security_service import security_service

class ModerationService:
    # Patterns to detect common scam attempts
    SCAM_PATTERNS = [
        (r"\+?\d{10,13}", "phone_number_share"), # WhatsApp redirect
        (r"whatsapp", "whatsapp_mention"),
        (r"crypto|bitcoin|eth|binance", "crypto_mention"),
        (r"payment|advance|deposit|m-pesa|zaad|sahay", "payment_request"),
        (r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", "link_share")
    ]

    def analyze_message(self, db: Session, sender: User, content: str) -> Tuple[bool, str]:
        """
        Analyzes a message for scam patterns.
        Returns (is_flagged, moderation_reason)
        """
        content_lower = content.lower()
        
        # 1. Check for suspicious keywords/patterns
        for pattern, reason in self.SCAM_PATTERNS:
            if re.search(pattern, content_lower):
                # If user is NEW or LOW TRUST, block the message
                if sender.trust_score < 200:
                    security_service.record_fraud_event(
                        db,
                        FraudTargetType.MESSAGE,
                        str(sender.id),
                        f"scam_pattern_{reason}",
                        risk_score=30,
                        confidence=0.8,
                        metadata={"content_snippet": content[:50]}
                    )
                    return True, f"suspicious_{reason}"
        
        return False, ""

    def analyze_listing(self, db: Session, owner: User, title: str, description: str, price: float) -> List[str]:
        """
        Analyzes a listing for common fraud signals.
        """
        flags = []
        
        # 1. Unrealistic Price Check (Heuristic: too low for title)
        # In a real system, this would use ML or historical averages
        if price < 10 and any(keyword in title.lower() for keyword in ["iphone", "toyota", "macbook", "land"]):
            flags.append("suspiciously_low_price")
            
        # 2. Description Content Analysis
        content = (title + " " + description).lower()
        for pattern, reason in self.SCAM_PATTERNS:
            if re.search(pattern, content):
                flags.append(f"suspicious_content_{reason}")
                
        if flags:
            security_service.record_fraud_event(
                db,
                FraudTargetType.LISTING,
                str(owner.id),
                "listing_fraud_signals",
                risk_score=len(flags) * 20,
                confidence=0.7,
                metadata={"flags": flags}
            )
            
        return flags

moderation_service = ModerationService()
