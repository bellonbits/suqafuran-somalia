from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api import deps
from app.models.campaign import Campaign, CampaignCreate, CampaignUpdate
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[Campaign])
def list_campaigns(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    List campaigns for the current seller (paginated).
    """
    statement = (
        select(Campaign)
        .where(Campaign.seller_id == current_user.id)
        .order_by(Campaign.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    campaigns = db.exec(statement).all()
    return campaigns


@router.post("", response_model=Campaign)
def create_campaign(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    campaign_in: CampaignCreate,
) -> Any:
    """
    Create a new campaign for the current seller.
    """
    campaign = Campaign(
        **campaign_in.model_dump(),
        seller_id=current_user.id,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.put("/{campaign_id}", response_model=Campaign)
def update_campaign(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    campaign_id: int,
    campaign_in: CampaignUpdate,
) -> Any:
    """
    Update a campaign.
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this campaign")

    update_data = campaign_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(campaign, key, value)

    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}")
def delete_campaign(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    campaign_id: int,
) -> Any:
    """
    Delete a campaign.
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this campaign")

    db.delete(campaign)
    db.commit()
    return {"success": True, "message": "Campaign deleted"}
