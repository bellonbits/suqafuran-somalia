from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user import User, TrustLevel
from app.models.fraud import RiskHistory, FraudEvent, FraudTargetType
from app.models.listing import Listing
from app.models.trust import Rating, Report

class TrustService:
    WEIGHTS = {
        "account_age_days": 2,
        "verified_identity": 300,
        "positive_rating": 20,
        "successful_deal": 50,
        "report_penalty": -200,
        "fraud_event_penalty": -300,
        "listing_quality_bonus": 10
    }

    def calculate_trust_score(self, db: Session, user: User) -> int:
        score = 0
        
        # 1. Account Age
        age = datetime.utcnow() - user.created_at
        score += min(200, age.days * self.WEIGHTS["account_age_days"])
        
        # 2. Verification Level
        if user.is_verified:
            score += self.WEIGHTS["verified_identity"]
            
        # 3. Ratings
        avg_rating = db.query(func.avg(Rating.score)).filter(Rating.rated_user_id == user.id).scalar() or 0
        rating_count = db.query(Rating).filter(Rating.rated_user_id == user.id).count()
        if rating_count > 0:
            score += int((avg_rating - 3) * 50) # Bonus for 4-5 stars, penalty for 1-2
            
        # 4. Active Listings & Quality
        listing_count = db.query(Listing).filter(Listing.owner_id == user.id).count()
        score += min(100, listing_count * self.WEIGHTS["listing_quality_bonus"])
        
        # 5. Penalties (Reports)
        report_count = db.query(Report).filter(Report.reported_user_id == user.id, Report.status != "dismissed").count()
        score += report_count * self.WEIGHTS["report_penalty"]
        
        # 6. Fraud Events
        fraud_events = db.query(FraudEvent).filter(
            FraudEvent.target_type == FraudTargetType.USER,
            FraudEvent.target_id == str(user.id)
        ).all()
        for event in fraud_events:
            score += self.WEIGHTS["fraud_event_penalty"] * (event.risk_score / 100)

        # Normalize score 0-1000
        final_score = max(0, min(1000, score))
        return int(final_score)

    def update_user_trust(self, db: Session, user: User):
        old_score = user.trust_score
        new_score = self.calculate_trust_score(db, user)
        
        if old_score != new_score:
            user.trust_score = new_score
            
            # Update Trust Level
            if new_score >= 800:
                user.trust_level = TrustLevel.TRUSTED
            elif new_score >= 500:
                user.trust_level = TrustLevel.VERIFIED
            elif new_score >= 200:
                user.trust_level = TrustLevel.ESTABLISHED
            else:
                user.trust_level = TrustLevel.NEW
                
            db.add(user)
            
            # Record History
            history = RiskHistory(
                user_id=user.id,
                old_score=old_score,
                new_score=new_score,
                reason="automated_recalculation",
                change_type="automated"
            )
            db.add(history)
            db.commit()

trust_service = TrustService()
