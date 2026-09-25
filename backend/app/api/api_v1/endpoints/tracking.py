"""Email tracking endpoints for opens and clicks."""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlmodel import Session
import io
from PIL import Image
import urllib.parse
from app.api import deps
from app.services.email_tracking_service import email_tracking_service
from app.core.logging_config import get_logger

logger = get_logger("tracking")

router = APIRouter()


def generate_tracking_pixel() -> bytes:
    """Generate a 1x1 transparent PNG pixel."""
    img = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
    pixel_io = io.BytesIO()
    img.save(pixel_io, 'PNG')
    pixel_io.seek(0)
    return pixel_io.getvalue()


@router.get("/pixel/{campaign_id}")
def track_email_open(
    campaign_id: int,
    *,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Track email open via 1x1 pixel.

    This endpoint should be called via an <img> tag in the email:
    <img src="/api/tracking/pixel/{campaign_id}" width="1" height="1" style="display:none;" />

    Returns a 1x1 transparent PNG that logs the open when loaded.
    """
    try:
        # Track the open
        campaign = email_tracking_service.track_email_open(db, campaign_id)

        if not campaign:
            logger.warning(f"Campaign {campaign_id} not found for pixel tracking")

        # Return transparent 1x1 pixel
        pixel_bytes = generate_tracking_pixel()
        return StreamingResponse(
            iter([pixel_bytes]),
            media_type="image/png",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )

    except Exception as e:
        logger.error(f"Error tracking pixel for campaign {campaign_id}: {e}")
        # Still return pixel even on error
        pixel_bytes = generate_tracking_pixel()
        return StreamingResponse(iter([pixel_bytes]), media_type="image/png")


@router.get("/click/{campaign_id}/{link_name}")
def track_email_click(
    campaign_id: int,
    link_name: str,
    target: str = "",
    *,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Track email click and redirect to target URL.

    This endpoint tracks when a user clicks a link in an email and then
    redirects them to the original destination.

    Query Parameters:
    - target: URL-encoded target URL to redirect to

    Example:
    /api/tracking/click/123/cta_button?target=https%3A%2F%2Fsuqafuran.com
    """
    try:
        # Decode target URL
        decoded_target = urllib.parse.unquote(target)

        # Track the click
        campaign = email_tracking_service.track_email_click(
            db,
            campaign_id,
            link_name=link_name,
            original_url=decoded_target
        )

        if not campaign:
            logger.warning(f"Campaign {campaign_id} not found for click tracking")

        # Redirect to target if provided
        if decoded_target:
            # Validate it's a reasonable URL
            if decoded_target.startswith(('http://', 'https://', '/')):
                return RedirectResponse(url=decoded_target)
            else:
                logger.warning(f"Invalid target URL: {decoded_target}")
                return RedirectResponse(url="/")

        return {"status": "tracked"}

    except Exception as e:
        logger.error(f"Error tracking click for campaign {campaign_id}: {e}")
        # Still redirect even on error if target provided
        if target:
            decoded_target = urllib.parse.unquote(target)
            if decoded_target.startswith(('http://', 'https://', '/')):
                return RedirectResponse(url=decoded_target)
        return RedirectResponse(url="/")


@router.get("/stats/{campaign_id}")
def get_tracking_stats(
    campaign_id: int,
    *,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Get tracking stats for a campaign (opens and clicks)."""
    return email_tracking_service.get_tracking_stats(db, campaign_id)
