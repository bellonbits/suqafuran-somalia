"""Admin endpoints for customer segmentation."""

from typing import Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
import json

from app.api import deps
from app.models.user import User
from app.models.customer_segment import (
    CustomerSegment, CustomerSegmentCreate, CustomerSegmentUpdate, CustomerSegmentRead,
    SegmentCriteria, SegmentCampaignRequest
)
from app.services.segmentation_service import segmentation_service
from app.services.system_messaging_service import send_bulk_system_message
from app.core.logging_config import get_logger

logger = get_logger("customer_segments")

router = APIRouter()


class SegmentMembersResponse(BaseModel):
    members: list[dict]
    total_count: int
    limit: int
    offset: int


def _check_admin_permission(current_user: User):
    """Verify user has admin permission."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage customer segments"
        )


@router.get("/", response_model=list[CustomerSegmentRead])
def list_segments(
    is_active: Optional[bool] = None,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all customer segments."""
    _check_admin_permission(current_user)

    query = select(CustomerSegment)
    if is_active is not None:
        query = query.where(CustomerSegment.is_active == is_active)

    segments = db.exec(query.order_by(CustomerSegment.created_at.desc())).all()
    return segments


@router.get("/templates", response_model=list[dict])
def get_segment_templates(
    *,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get predefined segment templates."""
    _check_admin_permission(current_user)
    return segmentation_service.get_predefined_segments()


@router.get("/{segment_id}", response_model=CustomerSegmentRead)
def get_segment(
    segment_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get a specific segment."""
    _check_admin_permission(current_user)

    segment = db.get(CustomerSegment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    return segment


@router.post("/", response_model=CustomerSegmentRead)
def create_segment(
    segment_in: CustomerSegmentCreate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create a new customer segment."""
    _check_admin_permission(current_user)

    try:
        # Validate JSON criteria
        criteria = json.loads(segment_in.criteria) if isinstance(segment_in.criteria, str) else segment_in.criteria
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in criteria")

    segment = CustomerSegment(
        **segment_in.dict(),
        created_by=current_user.id
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)

    # Calculate member count
    segmentation_service.update_segment_member_count(db, segment)

    logger.info(f"Created customer segment: {segment.name} (ID: {segment.id}, Members: {segment.member_count})")
    return segment


@router.put("/{segment_id}", response_model=CustomerSegmentRead)
def update_segment(
    segment_id: int,
    segment_in: CustomerSegmentUpdate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update a customer segment."""
    _check_admin_permission(current_user)

    segment = db.get(CustomerSegment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Validate JSON criteria if provided
    update_data = segment_in.dict(exclude_unset=True)
    if "criteria" in update_data:
        try:
            criteria = json.loads(update_data["criteria"]) if isinstance(update_data["criteria"], str) else update_data["criteria"]
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in criteria")

    update_data["updated_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(segment, field, value)

    db.add(segment)
    db.commit()
    db.refresh(segment)

    # Recalculate member count if criteria changed
    if "criteria" in update_data:
        segmentation_service.update_segment_member_count(db, segment)

    logger.info(f"Updated customer segment: {segment.name} (ID: {segment.id})")
    return segment


@router.delete("/{segment_id}")
def delete_segment(
    segment_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete a customer segment (soft delete)."""
    _check_admin_permission(current_user)

    segment = db.get(CustomerSegment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    segment.is_active = False
    segment.updated_at = datetime.utcnow()
    db.add(segment)
    db.commit()

    logger.info(f"Deactivated customer segment: {segment.name} (ID: {segment.id})")
    return {"status": "deleted", "id": segment_id}


@router.get("/{segment_id}/members", response_model=SegmentMembersResponse)
def get_segment_members(
    segment_id: int,
    limit: int = 100,
    offset: int = 0,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get users matching a segment (paginated)."""
    _check_admin_permission(current_user)

    limit = min(limit, 1000)  # Max 1000 per request

    segment = db.get(CustomerSegment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    members, total_count = segmentation_service.get_segment_members(db, segment, limit, offset)

    return {
        "members": [
            {
                "id": m.id,
                "full_name": m.full_name,
                "email": m.email,
                "is_seller": m.is_seller,
                "verified_level": m.verified_level
            }
            for m in members
        ],
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }


@router.post("/{segment_id}/send-campaign")
def send_campaign_to_segment(
    segment_id: int,
    campaign: SegmentCampaignRequest,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Send a message campaign to all users in a segment."""
    _check_admin_permission(current_user)

    segment = db.get(CustomerSegment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    if not segment.is_active:
        raise HTTPException(status_code=400, detail="Segment is inactive")

    # Get segment members
    members, total_count = segmentation_service.get_segment_members(db, segment, limit=10000)
    member_ids = [m.id for m in members]

    if not member_ids:
        return {
            "status": "no_members",
            "message": "Segment has no matching users",
            "total_count": 0
        }

    if campaign.dry_run:
        return {
            "status": "dry_run",
            "message": f"Would send to {len(member_ids)} users",
            "total_count": len(member_ids)
        }

    try:
        result = send_bulk_system_message(
            db=db,
            recipient_user_ids=member_ids,
            message_content=campaign.message,
            message_type=campaign.message_type
        )

        logger.info(
            f"Campaign sent to segment {segment.id}: {result['success']} success, "
            f"{result['failed']} failed"
        )

        return {
            "status": "sent",
            "success": result['success'],
            "failed": result['failed'],
            "errors": result.get('errors'),
            "segment_id": segment_id,
            "segment_name": segment.name
        }

    except Exception as e:
        logger.error(f"Failed to send campaign to segment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send campaign"
        )
