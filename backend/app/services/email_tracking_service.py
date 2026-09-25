"""Email tracking service for opens and click tracking."""

from datetime import datetime
from typing import Optional
from sqlmodel import Session
from app.models.marketing import EmailCampaign
from app.core.config import settings
from app.core.logging_config import get_logger
import hashlib
import urllib.parse

logger = get_logger("email_tracking_service")


class EmailTrackingService:
    """Handles email open and click tracking."""

    @staticmethod
    def generate_tracking_pixel_url(campaign_id: int) -> str:
        """
        Generate tracking pixel URL for email opens.

        Returns a URL to a 1x1 transparent pixel that logs when loaded.
        """
        return f"{settings.FRONTEND_URL}/api/tracking/pixel/{campaign_id}"

    @staticmethod
    def generate_tracking_link(
        campaign_id: int,
        original_url: str,
        link_name: str = "link"
    ) -> str:
        """
        Generate a tracking link for click tracking.

        Wraps original URL with tracking endpoint that logs clicks.

        Args:
            campaign_id: Email campaign ID
            original_url: The original link user should be redirected to
            link_name: Name/identifier for this link (for categorization)

        Returns:
            Tracking URL that logs click and redirects to original
        """
        # URL-encode the original URL
        encoded_url = urllib.parse.quote(original_url, safe='')
        return f"{settings.FRONTEND_URL}/api/tracking/click/{campaign_id}/{link_name}?target={encoded_url}"

    @staticmethod
    def track_email_open(
        db: Session,
        campaign_id: int
    ) -> Optional[EmailCampaign]:
        """
        Record email open when tracking pixel is loaded.

        Args:
            db: Database session
            campaign_id: Campaign ID to mark as opened

        Returns:
            Updated EmailCampaign or None if not found
        """
        try:
            campaign = db.get(EmailCampaign, campaign_id)
            if not campaign:
                logger.warning(f"Campaign {campaign_id} not found for open tracking")
                return None

            # Only mark as opened if not already opened
            if not campaign.opened_at:
                campaign.opened_at = datetime.utcnow()
                db.add(campaign)
                db.commit()
                db.refresh(campaign)
                logger.info(f"Email campaign {campaign_id} marked as opened")

            return campaign

        except Exception as e:
            logger.error(f"Failed to track email open for campaign {campaign_id}: {e}")
            return None

    @staticmethod
    def track_email_click(
        db: Session,
        campaign_id: int,
        link_name: str = "unknown",
        original_url: str = ""
    ) -> Optional[EmailCampaign]:
        """
        Record email click when tracking link is accessed.

        Args:
            db: Database session
            campaign_id: Campaign ID
            link_name: Name of the clicked link
            original_url: Original destination URL

        Returns:
            Updated EmailCampaign or None if not found
        """
        try:
            campaign = db.get(EmailCampaign, campaign_id)
            if not campaign:
                logger.warning(f"Campaign {campaign_id} not found for click tracking")
                return None

            # Mark as clicked if not already clicked
            if not campaign.clicked_at:
                campaign.clicked_at = datetime.utcnow()
                campaign.clicked_link = f"{link_name}:{original_url}"[:200]  # Store link info
                db.add(campaign)
                db.commit()
                db.refresh(campaign)
                logger.info(f"Email campaign {campaign_id} click tracked: {link_name}")

            return campaign

        except Exception as e:
            logger.error(f"Failed to track email click for campaign {campaign_id}: {e}")
            return None

    @staticmethod
    def get_tracking_stats(db: Session, campaign_id: int) -> dict:
        """Get tracking stats for a campaign."""
        try:
            campaign = db.get(EmailCampaign, campaign_id)
            if not campaign:
                return {"error": "Campaign not found"}

            return {
                "campaign_id": campaign_id,
                "opened": bool(campaign.opened_at),
                "clicked": bool(campaign.clicked_at),
                "opened_at": campaign.opened_at.isoformat() if campaign.opened_at else None,
                "clicked_at": campaign.clicked_at.isoformat() if campaign.clicked_at else None,
                "clicked_link": campaign.clicked_link
            }
        except Exception as e:
            logger.error(f"Failed to get tracking stats for campaign {campaign_id}: {e}")
            return {"error": str(e)}


# Initialize service
email_tracking_service = EmailTrackingService()
