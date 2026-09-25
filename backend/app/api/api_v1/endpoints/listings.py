from typing import Any, List, Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks, Header, Form
from sqlmodel import Session, select, func
from pydantic import BaseModel
from app.api import deps
from app.crud import crud_listing
from app.models.listing import Listing, ListingBase, ListingRead, Category, SubSubCategory
from app.models.subcategory import Subcategory
from app.core.metrics import LISTINGS_CREATED_TOTAL
from app.models.user import User
from app.models.audit import AuditLog
from app.models.marketing_code import MarketingCode
from app.services.cache_service import cache
from app.services.security_service import security_service
from app.services.moderation_service import moderation_service
from app.services.marketing_service import marketing_service
from app.models.marketing import EmailEventType
from app.core.security import risk_security
from app.core.config import settings
from app.services.kafka_producer import publish_upload_failure_event, publish_tracking_event
import uuid
import os
from app.services.storage_service import storage_service
from app.services.screening_service import calculate_listing_risk
from app.services.shop_category_service import update_shop_primary_category
from app.services.shop_listing_sync_service import sync_shop_listings_to_primary_category
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter()


class ListingRejectionRequest(BaseModel):
    reason: str
    notes: Optional[str] = None


class ListingApprovalRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/upload", response_model=dict)
async def upload_image(
    *,
    file: UploadFile = File(...),
    high_quality: bool = Form(False),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload a single image for a listing.

    high_quality=true skips the usual resize/compress pipeline (meant for
    marketing creatives like homepage banners, where crisp text/logos
    matter more than bandwidth) and uploads the original bytes untouched.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    extension = file.filename.split(".")[-1].lower()
    if extension not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File extension not allowed")

    contents = await file.read(settings.MAX_FILE_SIZE + 1)
    if len(contents) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    filename = f"{uuid.uuid4()}.{extension}"

    try:
        url, phash = await storage_service.upload_file(contents, filename, high_quality=high_quality)
        return {
            "filename": filename,
            "url": url,
            "phash": phash
        }
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Failed to upload image {filename}: {error_msg}")
        # Publish upload failure event
        try:
            await publish_upload_failure_event(
                user_id=current_user.id,
                endpoint="/listings/upload",
                filename=filename,
                error=error_msg,
                file_type="image",
            )
        except Exception as pub_err:
            logger.warning(f"Failed to publish upload failure event: {pub_err}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {error_msg}")


@router.post("/upload-multiple", response_model=List[dict])
async def upload_multiple_images(
    *,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload multiple images for a listing.
    Returns list of uploaded image info with url and filename.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results = []
    for file in files:
        if not file.filename:
            continue

        extension = file.filename.split(".")[-1].lower()
        if extension not in settings.ALLOWED_EXTENSIONS:
            continue

        contents = await file.read(settings.MAX_FILE_SIZE + 1)
        if len(contents) > settings.MAX_FILE_SIZE:
            continue

        filename = f"{uuid.uuid4()}.{extension}"

        try:
            url, phash = await storage_service.upload_file(contents, filename)
            results.append({
                "filename": filename,
                "url": url,
                "phash": phash
            })
        except Exception as e:
            error_msg = str(e)
            logger.warning(f"⚠️ Failed to upload image {filename}: {error_msg}")
            # Publish upload failure event
            try:
                await publish_upload_failure_event(
                    user_id=current_user.id,
                    endpoint="/listings/upload-multiple",
                    filename=filename,
                    error=error_msg,
                    file_type="image",
                )
            except Exception as pub_err:
                logger.debug(f"Failed to publish upload failure event: {pub_err}")
            # Skip failed files and continue with others
            continue

    if not results:
        raise HTTPException(status_code=400, detail="No valid files were uploaded")

    return results


@router.post("/upload-video", response_model=dict)
async def upload_video(
    *,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upload a video for a listing (up to 100 MB)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    extension = file.filename.split(".")[-1].lower()
    if extension not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Video format not supported. Use mp4, webm, or mov.")

    contents = await file.read(settings.MAX_VIDEO_SIZE + 1)
    if len(contents) > settings.MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Video too large. Max 100 MB.")

    filename = f"vid_{uuid.uuid4()}.{extension}"
    try:
        url, _ = await storage_service.upload_file(contents, filename)
        return {"filename": filename, "url": url}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Failed to upload video {filename}: {error_msg}")
        # Publish upload failure event
        try:
            await publish_upload_failure_event(
                user_id=current_user.id,
                endpoint="/listings/upload-video",
                filename=filename,
                error=error_msg,
                file_type="video",
            )
        except Exception as pub_err:
            logger.warning(f"Failed to publish upload failure event: {pub_err}")
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {error_msg}")


@router.get("/categories", response_model=List[Any])
@cache.cached(prefix="categories", ttl=60)
def read_categories(
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Retrieve categories with subcategories.
    Includes active_listing_count so clients can filter to categories
    that actually have live ads.

    Cached for 60s (see app/services/cache_service.py) -- every category/
    subcategory mutation elsewhere in this file already calls
    cache.delete_pattern("cache:categories:*") to invalidate it, but this
    endpoint was never actually decorated to populate that cache, so every
    request was hitting the DB regardless.
    """
    import json
    from sqlalchemy import text

    # Single efficient query: count active listings per category
    rows = db.execute(
        text(
            """
            SELECT l.category_id, COUNT(*) AS cnt
            FROM listing l
            JOIN "user" u ON u.id = l.owner_id
            WHERE l.status = 'active'
              AND u.is_suspended = false
            GROUP BY l.category_id
            """
        )
    ).fetchall()
    active_counts: dict[int, int] = {row.category_id: row.cnt for row in rows}

    categories = crud_listing.get_categories(db)

    # Batch-fetch every subcategory and sub-subcategory up front instead of
    # querying per category/subcategory. The old version ran one query per
    # category for its subcategories, then one query per subcategory for its
    # sub-subcategories -- 2+N+M total round trips to the DB for N
    # categories/M subcategories, a real chunk of this endpoint's latency
    # (measured ~0.7-1s server-side vs. <0.1s for sibling endpoints).
    all_subs = crud_listing.get_subcategories(db)
    subs_by_category: dict = {}
    for sub in all_subs:
        subs_by_category.setdefault(sub.category_id, []).append(sub)

    all_subsubs = db.exec(select(SubSubCategory)).all()
    subsubs_by_subcategory: dict = {}
    for ssub in all_subsubs:
        subsubs_by_subcategory.setdefault(ssub.subcategory_id, []).append(ssub)

    result = []

    for cat in categories:
        cat_attrs = cat.attributes_schema
        if isinstance(cat_attrs, str):
            try: cat_attrs = json.loads(cat_attrs)
            except: cat_attrs = {}

        subcategories = []
        for sub in subs_by_category.get(cat.id, []):
            subcategories.append({
                "id": sub.id,
                "name_en": sub.name_en,
                "name_so": sub.name_so,
                "slug": sub.slug,
                "image_url": sub.image_url,
                "subsubcategories": [
                    {
                        "id": ssub.id,
                        "name_en": ssub.name_en,
                        "name_so": ssub.name_so,
                        "slug": ssub.slug,
                        "image_url": ssub.image_url,
                        "brands": ssub.brands or [],
                    }
                    for ssub in subsubs_by_subcategory.get(sub.id, [])
                ],
            })

        cat_dict = {
            "id": cat.id,
            "name_en": cat.name_en,
            "name_so": cat.name_so,
            "slug": cat.slug,
            "icon_name": cat.icon_name,
            "image_url": cat.image_url,
            "attributes_schema": cat_attrs,
            "subcategories": subcategories,
            "active_listing_count": active_counts.get(cat.id, 0),
        }
        result.append(cat_dict)

    return result


@router.get("/categories/stats/shop-counts")
def get_shop_counts_by_category(
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get count of verified shops per category (by their active listings).
    Matches the shops endpoint logic - counts all verified users with active listings.
    Returns: { "category_id": shop_count, ... }
    """
    from sqlalchemy import text

    rows = db.execute(
        text("""
            SELECT l.category_id, COUNT(DISTINCT u.id) as shop_count
            FROM "user" u
            INNER JOIN listing l ON l.owner_id = u.id AND l.status = 'active'
            WHERE u.is_verified = true
            GROUP BY l.category_id
        """)
    ).fetchall()

    shop_counts: dict[int, int] = {}
    for row in rows:
        if row[0]:
            shop_counts[row[0]] = int(row[1])

    return shop_counts


@router.post("/categories", response_model=Any)
def create_category(
    *,
    db: Session = Depends(deps.get_db),
    category_in: dict,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create a new category (Admin only).
    """
    # Check if slug exists
    if crud_listing.get_category_by_slug(db, category_in["slug"]):
        raise HTTPException(status_code=400, detail="Category slug already exists")
    
    cat = Category(
        name_en=category_in["name_en"],
        name_so=category_in.get("name_so"),
        slug=category_in["slug"],
        icon_name=category_in["icon_name"],
        image_url=category_in.get("image_url"),
        attributes_schema=category_in.get("attributes_schema", {})
    )
    result = crud_listing.create_category(db, category_in=cat)
    cache.delete_pattern("cache:categories:*")
    return result


@router.patch("/categories/{id}", response_model=Any)
def update_category(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    category_in: dict,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update a category (Admin only).
    """
    category = db.get(Category, id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for field, value in category_in.items():
        if hasattr(category, field):
            setattr(category, field, value)
    
    db.add(category)
    db.commit()
    db.refresh(category)
    cache.delete_pattern("cache:categories:*")
    return category


@router.delete("/categories/{id}", response_model=Any)
def delete_category(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete a category (Admin only).
    """
    result = crud_listing.remove_category(db, id=id)
    cache.delete_pattern("cache:categories:*")
    return result


@router.post("/subcategories", response_model=Any)
def create_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    subcategory_in: dict,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create a new subcategory (Admin only).
    """
    # Check if slug exists
    if crud_listing.get_subcategory_by_slug(db, subcategory_in["slug"]):
        raise HTTPException(status_code=400, detail="Subcategory slug already exists")

    subcat = Subcategory(
        name_en=subcategory_in["name_en"],
        name_so=subcategory_in.get("name_so"),
        slug=subcategory_in["slug"],
        image_url=subcategory_in.get("image_url"),
        category_id=subcategory_in["category_id"],
    )
    result = crud_listing.create_subcategory(db, subcategory_in=subcat)
    cache.delete_pattern("cache:categories:*")
    return result


@router.patch("/subcategories/{id}", response_model=Any)
def update_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    subcategory_in: dict,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update a subcategory (Admin only).
    """
    subcat = db.get(Subcategory, id)
    if not subcat:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    result = crud_listing.update_subcategory(db, db_obj=subcat, subcategory_in=subcategory_in)
    cache.delete_pattern("cache:categories:*")
    return result


@router.delete("/subcategories/{id}", response_model=Any)
def delete_subcategory(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete a subcategory (Admin only).
    """
    result = crud_listing.remove_subcategory(db, id=id)
    cache.delete_pattern("cache:categories:*")
    return result


@router.post("/subsubcategories", response_model=Any)
def create_subsubcategory(
    *,
    db: Session = Depends(deps.get_db),
    subsubcategory_in: dict,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create a new sub-subcategory (Admin only).
    """
    # Check if slug exists
    if db.exec(select(SubSubCategory).where(SubSubCategory.slug == subsubcategory_in["slug"])).first():
        raise HTTPException(status_code=400, detail="Sub-subcategory slug already exists")
    
    subsubcat = SubSubCategory(
        name_en=subsubcategory_in["name_en"],
        name_so=subsubcategory_in.get("name_so"),
        slug=subsubcategory_in["slug"],
        image_url=subsubcategory_in.get("image_url"),
        subcategory_id=subsubcategory_in["subcategory_id"],
        brands=subsubcategory_in.get("brands"),
    )
    db.add(subsubcat)
    db.commit()
    db.refresh(subsubcat)
    cache.delete_pattern("cache:categories:*")
    return subsubcat


@router.patch("/subsubcategories/{id}", response_model=Any)
def update_subsubcategory(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    subsubcategory_in: dict,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update a sub-subcategory (Admin only).
    """
    subsubcat = db.get(SubSubCategory, id)
    if not subsubcat:
        raise HTTPException(status_code=404, detail="Sub-subcategory not found")
    
    for field, value in subsubcategory_in.items():
        if hasattr(subsubcat, field):
            setattr(subsubcat, field, value)
    
    db.add(subsubcat)
    db.commit()
    db.refresh(subsubcat)
    cache.delete_pattern("cache:categories:*")
    return subsubcat


@router.delete("/subsubcategories/{id}", response_model=Any)
def delete_subsubcategory(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete a sub-subcategory (Admin only).
    """
    subsubcat = db.get(SubSubCategory, id)
    if not subsubcat:
        raise HTTPException(status_code=404, detail="Sub-subcategory not found")
    db.delete(subsubcat)
    db.commit()
    cache.delete_pattern("cache:categories:*")
    return subsubcat


@router.get("/categories/{slug}/attributes", response_model=dict)
def read_category_attributes(
    *,
    db: Session = Depends(deps.get_db),
    slug: str,
) -> Any:
    """
    Get dynamic attribute schema for a specific category.
    """
    category = crud_listing.get_category_by_slug(db, slug=slug)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category.attributes_schema


@router.get("/subcategories/{id}/attributes", response_model=dict)
def read_subcategory_attributes(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
) -> Any:
    """
    Get dynamic attribute schema for a specific subcategory.
    Returns an empty dict if no attributes defined.
    """
    subcategory = db.get(Subcategory, id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    attrs = subcategory.attributes_schema
    if isinstance(attrs, str):
        try:
            import json
            attrs = json.loads(attrs)
        except:
            attrs = {}
    return attrs if attrs else {}


@router.get("/subsubcategories/{id}/attributes", response_model=dict)
def read_subsubcategory_attributes(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
) -> Any:
    """
    Get dynamic attribute schema for a specific sub-subcategory.
    Returns an empty dict if no attributes defined.
    """
    subsubcategory = db.get(SubSubCategory, id)
    if not subsubcategory:
        raise HTTPException(status_code=404, detail="Sub-subcategory not found")
    attrs = subsubcategory.attributes_schema
    if isinstance(attrs, str):
        try:
            import json
            attrs = json.loads(attrs)
        except:
            attrs = {}
    return attrs if attrs else {}


@router.get("/me", response_model=List[ListingRead])
def read_my_listings(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve listings of current user.
    """
    return crud_listing.get_listings(db, skip=skip, limit=limit, owner_id=current_user.id)


def _listings_fully_loaded(listings: List[ListingRead]) -> bool:
    """Guards against caching a result where the owner relationship is missing
    for a listing that has an owner_id."""
    return all(l.owner is not None for l in listings if l.owner_id)


@router.get("/", response_model=List[ListingRead])
@cache.cached(prefix="listings", ttl=60, should_cache=_listings_fully_loaded)
def read_listings(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[str] = None,
    owner_id: Optional[int] = None,
    q: Optional[str] = None,
    location: Optional[str] = None,
    attrs: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Retrieve listings.
    category_id can be either a numeric ID or a category slug (e.g., 'animals')
    approval_status can be: pending, approved, rejected (admin/agent only)
    """
    attributes = None
    if attrs:
        import json
        try:
            attributes = json.loads(attrs)
        except:
            pass

    # Resolve category_id if it's a slug
    resolved_category_id = None
    if category_id:
        try:
            resolved_category_id = int(category_id)
        except ValueError:
            category = crud_listing.get_category_by_slug(db, slug=category_id)
            if category:
                resolved_category_id = category.id
            else:
                # Unknown category slug: return no results rather than
                # silently dropping the filter and returning everything.
                return []

    # Security: Only admins/agents can filter by approval status or see non-active statuses
    effective_status = status
    effective_approval_status = approval_status
    if not current_user or not (current_user.is_admin or current_user.is_agent):
        effective_status = "active"
        effective_approval_status = None  # Regular users can't filter by approval status

    # If approval_status filter is requested, apply additional filtering
    listings = crud_listing.get_listings(
        db,
        skip=skip,
        limit=limit,
        category_id=resolved_category_id,
        search=q,
        status=effective_status,
        location=location,
        attributes=attributes,
        owner_id=owner_id,
        min_price=min_price,
        max_price=max_price,
    )

    # Additional approval_status filtering for admins/agents
    if effective_approval_status and (current_user and (current_user.is_admin or current_user.is_agent)):
        listings = [l for l in listings if l.approval_status == effective_approval_status]

    # Convert to the read schema here (rather than relying on response_model to do it
    # after the fact) so the cache decorator stores/replays the same shape. `owner` is
    # a SQLAlchemy Relationship() on the raw Listing table model, not a Pydantic field,
    # so jsonable_encoder silently drops it when caching raw ORM objects — every cache
    # *write* was correct in memory but lost `owner` on serialization, then every cache
    # *hit* served it back as null. ListingRead declares `owner` as a real field, so
    # encoding it (for cache storage) round-trips correctly.
    return [ListingRead.model_validate(l) for l in listings]


@router.post("/", response_model=Listing)
async def create_listing(
    *,
    db: Session = Depends(deps.get_db),
    listing_in: ListingBase,
    current_user: User = Depends(deps.get_current_active_user),
    owner_id: Optional[int] = None,
    x_device_fingerprint: Optional[str] = Header(None),
) -> Any:
    """
    Create new listing.
    """
    # Determine effective owner (Admin/Agent impersonation support) up front so
    # verification, subscription, and duplicate checks below apply to the
    # shop actually receiving the listing, not to the admin/agent's own account.
    effective_owner_id = current_user.id
    if owner_id and (current_user.is_admin or current_user.is_agent):
        target_user = db.get(User, owner_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user for impersonation not found")
        effective_owner_id = owner_id
    owner_for_checks = db.get(User, effective_owner_id) if effective_owner_id != current_user.id else current_user

    # Verify the owner has at least tier2 trust level (ID/business verification) to create listings
    from app.models.user import UserVerifiedLevel
    if not owner_for_checks.has_verification_level(UserVerifiedLevel.tier2):
        raise HTTPException(
            status_code=403,
            detail="Account verification required to sell. Please verify your identity or business details to create listings."
        )

    # Check product limit based on subscription plan
    from app.services.subscription_service import subscription_service
    if not subscription_service.can_add_products(effective_owner_id, db):
        raise HTTPException(
            status_code=402,
            detail="Product limit reached. Upgrade to Pro plan for unlimited products. Start 7-day free trial to unlock more features."
        )

    # Prevent duplicated active listings from the same owner (allow reposting sold/closed/deleted ones)
    existing_duplicate = db.exec(
        select(Listing).where(
            Listing.owner_id == effective_owner_id,
            Listing.title_en == listing_in.title_en,
            Listing.status.in_(["active", "pending"])
        )
    ).first()
    if existing_duplicate:
        raise HTTPException(status_code=400, detail="Duplicate product detected. This shop already has a listing with this title.")
    # 1. Device Intelligence & Fingerprinting
    if x_device_fingerprint:
        device = security_service.get_or_create_device(db, x_device_fingerprint, {})
        security_service.link_user_to_device(db, current_user, device)
        if device.is_banned:
            raise HTTPException(status_code=403, detail="Access denied for this device.")

    # 2. Risk-Based Rate Limiting -- this exists to stop a low-trust actor
    # from spamming listings, so it doesn't apply when a trusted admin/agent
    # is posting on a shop's behalf (bulk import, onboarding a new shop,
    # etc). It previously keyed off current_user unconditionally, which
    # meant every admin/agent bulk-create shared one daily cap across every
    # shop they touched -- a large CSV import would trip it fast.
    if effective_owner_id == current_user.id:
        risk_security.check_listing_limit(current_user)

    # 3. Messaging & Content Moderation
    flags = moderation_service.analyze_listing(
        db, 
        current_user, 
        listing_in.title_en, 
        listing_in.description_en or "", 
        listing_in.price
    )
    
    # Layer 3.5: Duplicate Image Detection (PHash)
    if listing_in.image_hashes:
        for h in listing_in.image_hashes:
            if not h: continue
            # Check if this hash exists in other listings (not by this user)
            # In a real system, we'd use a specialized vector DB or Hamming distance index
            # For now, exact hash match for identifying repeated farm accounts
            # Fix: cast JSON to JSONB for proper containment check in PostgreSQL
            from sqlalchemy.dialects.postgresql import JSONB
            from sqlalchemy import cast
            
            duplicates = db.query(Listing).filter(
                cast(Listing.image_hashes, JSONB).contains([h]),
                Listing.owner_id != current_user.id
            ).count()
            
            if duplicates > 0:
                flags.append("duplicate_image_detected")
                break
    
    # Layer 6: Status Logic
    status = "active"

    # Auto-assign to shop's primary category if it exists
    if owner_for_checks and owner_for_checks.primary_category_id:
        listing_in.category_id = owner_for_checks.primary_category_id

    listing = crud_listing.create_listing(db, listing_in=listing_in, owner_id=effective_owner_id)
    listing.status = "pending"  # Draft status - not visible yet
    listing.moderation_status = "pending"  # Waiting for admin review
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Track business metric
    try:
        category_name = "unknown"
        if listing.category_id:
            cat = db.get(Category, listing.category_id)
            if cat:
                category_name = cat.name_en

        LISTINGS_CREATED_TOTAL.labels(
            category=category_name,
            location=listing.location or "unknown"
        ).inc()
    except Exception:
        pass # Never fail request due to metrics

    # Consolidated Audit Log
    db.add(AuditLog(
        user_id=current_user.id,
        action="CREATE_LISTING",
        resource_type="listing",
        resource_id=listing.id,
        details=f"Listing created with status 'pending' (moderation_status='pending')"
    ))

    # Track first-ad conversion for marketing referral codes
    if current_user.referral_code and not current_user.referral_listing_counted:
        mc = db.exec(select(MarketingCode).where(MarketingCode.code == current_user.referral_code)).first()
        if mc:
            mc.ads_posted_count += 1
            db.add(mc)
        current_user.referral_listing_counted = True
        db.add(current_user)

    db.commit()
    db.refresh(listing)

    # Update shop's primary category based on listing distribution
    try:
        update_shop_primary_category(db, current_user.id)
    except Exception:
        pass  # Never fail request due to category update

    # Publish Kafka event for moderation
    try:
        from app.services.kafka_producer import publish_catalog_event, publish_notification_dispatch

        await publish_catalog_event(
            event_type="product.created_pending_moderation",
            payload={
                "listing_id": str(listing.id),
                "owner_id": str(effective_owner_id),
                "title": listing.title_en,
                "price": float(listing.price),
                "category_id": listing.category_id,
                "images": listing.images[:1] if listing.images else [],
                "description": (listing.description_en or "")[:100],
            },
            seller_id=str(effective_owner_id),
        )

        # Notify admins about pending moderation
        await publish_notification_dispatch(
            user_id="admin_team",
            event_type="catalog.product.pending_moderation",
            channels=["email", "push"],
            template="admin_listing_requires_moderation",
            data={
                "listing_id": str(listing.id),
                "seller_name": current_user.full_name or current_user.phone or f"User {current_user.id}",
                "title": listing.title_en,
                "price": f"{listing.price} {listing.currency}",
            },
        )

        # Notify seller of submission
        await publish_notification_dispatch(
            user_id=str(effective_owner_id),
            event_type="catalog.product.created_pending_moderation",
            channels=["push", "sms"],
            template="listing_submitted_for_review",
            data={
                "listing_id": str(listing.id),
                "title": listing.title_en,
            },
        )
    except Exception as e:
        import logging
        logging.getLogger("listings_api").warning(f"Failed to publish listing creation event: {e}")

    # In-app notification for ad posting
    from app.crud.crud_notification import crud_notification
    try:
        crud_notification.create(
            db,
            obj_in={
                "type": "ad_posted",
                "data": {
                    "listing_id": listing.id,
                    "title": listing.title_en,
                    "status": "pending",
                    "message": f"Your listing '{listing.title_en}' has been submitted for review. You'll be notified within 4 hours."
                }
            },
            user_id=effective_owner_id
        )
    except Exception:
        pass

    # Push notification for ad posted
    from app.utils.push import send_push_to_user
    send_push_to_user(
        db,
        user_id=effective_owner_id,
        title="Listing Submitted!",
        body=f"'{listing.title_en}' is under review. We'll notify you soon.",
        data={"type": "ad_posted", "listing_id": str(listing.id), "path": f"/listing/{listing.id}"}
    )

    # Publish tracking event for listing creation
    try:
        category_obj = db.get(Category, listing.category_id)
        await publish_tracking_event(
            user_id=effective_owner_id,
            event_type="listing_created",
            page="/listings/create",
            action="create_listing",
            metadata={
                "listing_id": listing.id,
                "title": listing.title_en,
                "category": category_obj.name_en if category_obj else str(listing.category_id),
                "price": float(listing.price),
                "seller_name": owner_for_checks.business_name or owner_for_checks.full_name or f"User {effective_owner_id}",
            }
        )
    except Exception as e:
        logger.debug(f"Failed to publish tracking event: {e}")

    return listing




@router.get("/shops")
def get_public_shops(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    shop_id: Optional[str] = None,
    category_id: Optional[int] = None,
) -> Any:
    """
    Get all verified shops/sellers that have at least one active listing.
    Optionally filter by category_id.
    """
    from sqlalchemy import text
    import json as _json

    # Try cache first (except for searches)
    cache_key = f"public_shops:{skip}:{limit}:{category_id or 'all'}"
    if not search and not shop_id:
        try:
            cached = cache.get(cache_key)
            if cached:
                return _json.loads(cached)
        except Exception:
            pass

    try:
        # Build filters
        search_filter = ""
        category_filter = ""
        params = {"skip": skip, "limit": limit}

        if search:
            search_filter = "AND (u.business_name ILIKE :search OR u.full_name ILIKE :search)"
            params["search"] = f"%{search}%"

        if shop_id:
            search_filter += " AND u.id = :shop_id"
            params["shop_id"] = int(shop_id) if shop_id.isdigit() else shop_id

        if category_id is not None:
            # Filter by primary_category_id - each shop appears in only their primary category
            category_filter = "AND u.primary_category_id = :category_id"
            params["category_id"] = category_id

        # Rotation seed: changes every 10 seconds so the shop grid reshuffles
        # periodically instead of always showing the same shops in the same
        # (listing-count-dominated) order forever. Stable within the window
        # so pagination doesn't skip/repeat shops mid-browse.
        _now = datetime.utcnow()
        rotation_seed = f"{_now.strftime('%Y-%m-%d-%H-%M')}-{_now.second // 10}"
        params["rotation_seed"] = rotation_seed

        # Fast CTE-based aggregation
        # Count all active listings per shop (not filtered by category)
        query_str = f"""
            WITH shop_stats AS (
                SELECT l.owner_id,
                       COUNT(l.id) as listing_count,
                       MAX(l.created_at) as latest_listing
                FROM listing l
                WHERE l.status = 'active'
                GROUP BY l.owner_id
            )
            SELECT u.id,
                   CAST(u.id AS VARCHAR),
                   COALESCE(u.business_name, u.full_name, 'Shop'),
                   u.full_name,
                   COALESCE(u.location, ''),
                   u.created_at,
                   u.shop_page_banner,
                   COALESCE(u.response_time, 'Typically responds within a few hours'),
                   COALESCE(u.is_featured, false),
                   COALESCE(u.free_delivery, false),
                   COALESCE(ss.listing_count, 0),
                   ss.latest_listing,
                   COALESCE(u.market, 'Eastleigh Market'),
                   u.phone,
                   u.logo_url,
                   u.is_verified
            FROM "user" u
            LEFT JOIN shop_stats ss ON ss.owner_id = u.id
            WHERE u.business_name IS NOT NULL
              {category_filter}
              {search_filter}
            ORDER BY md5(u.id::text || :rotation_seed)
            LIMIT :limit OFFSET :skip
        """

        # Separate count query for total (runs fast without LIMIT)
        count_query_str = f"""
            SELECT COUNT(DISTINCT u.id)
            FROM "user" u
            WHERE u.business_name IS NOT NULL
              {category_filter}
              {search_filter.replace('AND (u.business_name', 'AND (u.business_name') if search_filter else ''}
        """

        # Execute main query to get all verified shops in category
        query = text(query_str)
        result = db.execute(query, params)
        rows = result.fetchall()

        # Build response from CTE results
        shops = []
        for row in rows:
            # Generate URL-friendly slug from shop name: all lowercase, alphanumeric only
            # e.g. "Moon Glow Cosmetics" -> "moonglowcosmetics"
            shop_name = row[2] or f'shop{row[0]}'
            import unicodedata
            normalized = unicodedata.normalize('NFKD', shop_name).encode('ascii', 'ignore').decode('ascii')
            slug = ''.join(c for c in normalized.lower() if c.isalnum())
            slug = slug or f'shop{row[0]}'  # Fallback if slug is empty

            shops.append({
                "id": str(row[0]),
                "user_id": str(row[1]),
                "shop_name": shop_name,
                "owner_name": row[3] or row[2],
                "category": "General",
                "shop_address": row[4] or "Eastleigh Market",
                "location_lat": -1.2789,
                "location_lng": 36.8532,
                "rating": 4.8,
                "is_verified": bool(row[15]),
                "listing_count": row[10],
                "category_ids": [1, 2, 3],
                "cover_image": None,
                "shop_page_banner": row[6],
                "logo_url": row[14],
                "owner_avatar_url": row[14],
                "slug": slug,
                "created_at": row[5].isoformat() if row[5] else None,
                "market": row[12] or "Eastleigh Market",
                "response_time": row[7],
                "is_featured": row[8],
                "free_delivery": row[9],
                "phone": row[13],
                "user": {
                    "id": str(row[0]),
                    "avatar_url": row[14],
                }
            })

        # Total count query
        count_query = text(count_query_str)
        total_count = db.execute(count_query, params).scalar() or len(shops)

        # Cache the result for this rotation window
        response_data = {"total": total_count, "shops": shops}
        try:
            cache.setex(cache_key, 10, _json.dumps(response_data))
        except Exception:
            pass

        return response_data
    except Exception as e:
        import logging
        logger = logging.getLogger("listings_api")
        logger.error(f"Error in get_public_shops: {str(e)}", exc_info=True)
        return {"total": 0, "shops": []}


@router.get("/shops/{slug}")
def get_shop_by_slug(
    *,
    slug: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get a single shop by ID or slug, including logo_url and verified status.
    """
    try:
        user = None
        # Check if slug is a numeric user ID -- only expose accounts that are
        # actually shops (business_name set), never arbitrary user records,
        # since this endpoint is public and unauthenticated.
        if slug.isdigit():
            candidate = db.get(User, int(slug))
            if candidate and candidate.business_name:
                user = candidate

        # If not found by ID, or slug is text, find by business name/slug match
        if not user:
            clean_slug = slug.lower().strip().replace('-', '').replace('_', '').replace(' ', '')
            all_users = db.exec(select(User).where(User.business_name.isnot(None))).all()
            for u in all_users:
                u_name = (u.business_name or u.full_name or '').lower().strip().replace('-', '').replace('_', '').replace(' ', '')
                if u_name == clean_slug or str(u.id) == slug:
                    user = u
                    break

        if not user:
            raise HTTPException(status_code=404, detail="Shop not found")

        # Count listings
        from sqlalchemy import func
        listing_count = db.exec(
            select(func.count(Listing.id)).where(Listing.owner_id == user.id, Listing.status == "active")
        ).one()

        shop_name = user.business_name or user.full_name or f"shop{user.id}"
        import unicodedata as _ud
        _normalized = _ud.normalize('NFKD', shop_name).encode('ascii', 'ignore').decode('ascii')
        derived_slug = ''.join(c for c in _normalized.lower() if c.isalnum()) or f"shop{user.id}"

        return {
            "id": str(user.id),
            "user_id": str(user.id),
            "shop_name": shop_name,
            "owner_name": user.full_name or shop_name,
            "category": "General",
            "shop_address": user.location or "Eastleigh Market",
            "location_lat": -1.2789,
            "location_lng": 36.8532,
            "rating": 4.8,
            "is_verified": bool(user.is_verified),
            "listing_count": listing_count,
            "category_ids": [1, 2, 3],
            "cover_image": user.shop_page_banner,
            "shop_page_banner": user.shop_page_banner,
            "logo_url": user.logo_url,
            "owner_avatar_url": user.avatar_url or user.logo_url,
            "slug": derived_slug,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "market": user.market or "Eastleigh Market",
            "response_time": user.response_time or "Typically responds within a few hours",
            "is_featured": bool(user.is_featured),
            "free_delivery": bool(user.free_delivery),
            "phone": user.phone,
            "user": {
                "id": str(user.id),
                "avatar_url": user.avatar_url or user.logo_url,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger("listings_api")
        logger.error(f"Error in get_shop_by_slug: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shops/{user_id}/banners")
def get_shop_banners(
    *,
    user_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get shop banners for a specific user/shop.
    Lightweight endpoint - returns only banner URLs (no auth required).
    """
    try:
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Shop not found")

        return {
            "user_id": user_id,
            "shop_page_banner": user.shop_page_banner,
            "shop_detail_banner": user.shop_detail_banner,
            "logo_url": user.logo_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{id}", response_model=ListingRead)
def read_listing(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Get listing by ID.
    """
    listing = crud_listing.get_listing(db=db, id=id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Increment views
    listing.views += 1
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Per-user view record (guests aren't tracked -- nothing to email them
    # at) so the "viewed but never messaged the seller" reminder and the
    # browsing-history-personalized promo campaigns have real data to work
    # from. Best-effort: a tracking write should never break the page.
    if current_user and current_user.id != listing.owner_id:
        try:
            from app.models.marketing import UserBrowsingHistory
            db.add(UserBrowsingHistory(
                user_id=current_user.id,
                listing_id=listing.id,
                category_id=listing.category_id,
                shop_id=listing.owner_id,
            ))
            db.commit()
        except Exception:
            db.rollback()

    # Query for owner's active business storefront and attach it
    listing_data = ListingRead.model_validate(listing)
    if listing_data.owner:
        from app.models.business import Business
        from sqlmodel import select
        business = db.exec(select(Business).where(Business.owner_id == listing.owner_id, Business.is_active == True)).first()
        if business:
            listing_data.owner.business = {
                "name": business.name,
                "slug": business.slug,
                "logo_url": business.logo_url,
                "banner_url": business.banner_url,
                "category": business.category,
                "is_verified": business.is_verified,
            }
    
    return listing_data



@router.put("/{id}", response_model=ListingRead)
def update_listing(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    listing_in: ListingBase,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a listing.
    """
    listing = crud_listing.get_listing(db=db, id=id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and (listing.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough privileges")
    listing = crud_listing.update_listing(db=db, db_obj=listing, listing_in=listing_in)

    # Recalculate shop's primary category based on updated listing
    try:
        update_shop_primary_category(db, listing.owner_id)
        # Clear all shop-related caches
        cache.delete_pattern("shops:*")
        cache.delete_pattern("public_shops:*")
    except Exception:
        pass  # Never fail request due to category update

    return listing


@router.patch("/{id}", response_model=ListingRead)
async def patch_listing(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    listing_in: dict,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Partially update a listing.
    """
    listing = crud_listing.get_listing(db=db, id=id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and (listing.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough privileges")

    from datetime import datetime as dt

    # Track old price for price drop detection
    old_price = listing.price

    for field, value in listing_in.items():
        if hasattr(listing, field):
            setattr(listing, field, value)

    # Auto-set sold_at when is_sold becomes True
    if listing_in.get('is_sold') is True and not listing.sold_at:
        listing.sold_at = dt.utcnow()
    # Keep status in sync: marking sold → status = "sold"
    if listing_in.get('is_sold') is True:
        listing.status = 'sold'

    listing.updated_at = dt.utcnow()
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Detect price drop and send notifications
    new_price = listing.price
    if 'price' in listing_in and old_price and new_price and new_price < old_price:
        try:
            # Send price drop notifications to users who saved this listing
            # This would query saves table to find interested buyers
            logger.info(f"Price drop detected: Listing {id} from {old_price} to {new_price}")
            # TODO: Query saves table and send price_dropped emails
        except Exception as e:
            logger.warning(f"Failed to process price drop notification: {e}")

    # Recalculate shop's primary category after any listing change
    try:
        update_shop_primary_category(db, listing.owner_id)
        # Clear all shop-related caches
        cache.delete_pattern("shops:*")
        cache.delete_pattern("public_shops:*")
    except Exception:
        pass  # Never fail request due to category update

    return listing


@router.delete("/{id}", response_model=ListingRead)
def delete_listing(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: User = Depends(deps.get_current_active_user),
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Delete a listing.
    """
    listing = crud_listing.get_listing(db=db, id=id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and (listing.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough privileges")

    owner_id = listing.owner_id
    is_admin_takedown = current_user.is_admin and owner_id != current_user.id
    listing_title = listing.title_en
    listing = crud_listing.remove_listing(db=db, id=id)

    # Recalculate shop's primary category after deletion
    try:
        update_shop_primary_category(db, owner_id)
        # Clear all shop-related caches
        cache.delete_pattern("shops:*")
        cache.delete_pattern("public_shops:*")
    except Exception:
        pass  # Never fail request due to category update

    # Only notify the owner when an admin removed their live listing --
    # not when they deleted it themselves.
    if is_admin_takedown:
        owner = db.get(User, owner_id)
        if owner and owner.email:
            from app.services.email_service import email_service
            background_tasks.add_task(
                email_service.send_listing_removed_email,
                owner.email, owner.full_name or "Customer", listing_title,
                "This listing was removed by a Suqafuran moderator for violating platform policy.",
                owner.id
            )

    return listing


from app.crud import crud_wallet
from datetime import datetime, timedelta

@router.post("/{id}/boost", response_model=dict)
def apply_listing_boost(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    boost_level: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Apply a boost to a specific listing.
    """
    BOOST_PRICES = {
        1: {"name": "Basic", "price": 500, "days": 7},
        2: {"name": "VIP", "price": 1500, "days": 14},
        3: {"name": "Diamond", "price": 3000, "days": 30},
    }
    
    if boost_level not in BOOST_PRICES:
        raise HTTPException(status_code=400, detail="Invalid boost level")
    
    listing = crud_listing.get_listing(db, id=id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    wallet = crud_wallet.get_wallet_by_user_id(db, user_id=current_user.id)
    if not wallet or wallet.balance < BOOST_PRICES[boost_level]["price"]:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    boost_config = BOOST_PRICES[boost_level]
    crud_wallet.deduct_funds(db, wallet=wallet, amount=boost_config["price"], description=f"Boost: {listing.title_en}")
    
    listing.boost_level = boost_level
    listing.boost_expires_at = datetime.utcnow() + timedelta(days=boost_config["days"])
    db.add(listing)
    db.commit()
    return {"message": "Success", "expires_at": listing.boost_expires_at}


@router.get("/admin/duplicates")
def find_duplicate_shops(db: Session = Depends(deps.get_db)):
    """Find all users with multiple seller accounts"""
    try:
        from sqlalchemy import text

        query = text("""
            SELECT user_id, COUNT(*) as shop_count,
                   array_agg(id) as ids,
                   array_agg(shop_name) as shop_names,
                   array_agg(created_at) as created_dates
            FROM sellers
            WHERE is_active = true
            AND verification_status = 'verified'
            GROUP BY user_id
            HAVING COUNT(*) > 1
            ORDER BY shop_count DESC
        """)

        result = db.execute(query)
        rows = result.fetchall()

        duplicates = []
        for row in rows:
            duplicates.append({
                "user_id": row[0],
                "shop_count": row[1],
                "shop_ids": row[2],
                "shop_names": row[3],
                "created_dates": [d.isoformat() if d else None for d in row[4]]
            })

        return {
            "total_duplicate_users": len(duplicates),
            "duplicates": duplicates
        }
    except Exception as e:
        print(f"Error finding duplicates: {str(e)}")
        return {"total_duplicate_users": 0, "duplicates": []}


@router.post("/admin/merge-duplicates")
def merge_duplicate_shops(
    user_id: str,
    keep_shop_id: str = None,
    db: Session = Depends(deps.get_db)
):
    """Merge duplicate shops for a user, keeping one and deactivating others"""
    try:
        from sqlalchemy import text

        # Get all shops for this user
        shops_query = text("SELECT id, created_at FROM sellers WHERE user_id = :user_id ORDER BY created_at DESC")
        result = db.execute(shops_query, {"user_id": user_id})
        shops = result.fetchall()

        if len(shops) <= 1:
            return {"message": "User has only one shop, no merge needed"}

        # Keep the newest one (first in ordered results) unless specified
        keeper_id = keep_shop_id or shops[0][0]

        # Deactivate all other shops
        deactivated = []
        for shop_id, _ in shops:
            if shop_id != keeper_id:
                update_query = text("UPDATE sellers SET is_active = false WHERE id = :id")
                db.execute(update_query, {"id": shop_id})
                deactivated.append(shop_id)

        db.commit()

        return {
            "message": f"Merged {len(deactivated)} duplicate shops",
            "kept_shop_id": keeper_id,
            "deactivated_shop_ids": deactivated
        }
    except Exception as e:
        db.rollback()
        print(f"Error merging shops: {str(e)}")
        return {"error": str(e)}


# ============== APPROVAL ENDPOINTS ==============

def _check_approval_permission(user: User) -> None:
    """Check if user has permission to approve/reject listings."""
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    if not (user.is_admin or user.is_agent):
        raise HTTPException(status_code=403, detail="Only admins and agents can approve/reject listings")


@router.post("/{listing_id}/approve")
async def approve_listing(
    listing_id: int,
    approval_req: ListingApprovalRequest,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Admin or Agent approves a listing for visibility.

    Requires: is_admin or is_agent role

    Published Events:
    - catalog.product.approved → Update search index, notify seller
    """
    # Check permissions (supports both admin and agent roles)
    _check_approval_permission(current_user)

    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Use CRUD method for approval
    listing = crud_listing.approve_listing(
        db,
        listing=listing,
        approved_by_user_id=current_user.id,
        notes=approval_req.notes
    )

    # Recalculate shop's primary category after approval
    try:
        update_shop_primary_category(db, listing.owner_id)
        cache.delete_pattern("shops:*")
        cache.delete_pattern("public_shops:*")
    except Exception:
        pass

    # Publish Kafka event
    try:
        from app.services.kafka_producer import publish_catalog_event, publish_notification_dispatch

        await publish_catalog_event(
            event_type="product.approved",
            payload={
                "listing_id": str(listing.id),
                "owner_id": str(listing.owner_id),
                "title": listing.title_en,
                "approved_by": current_user.full_name or f"Admin {current_user.id}",
            },
            seller_id=str(listing.owner_id),
        )

        # Notify seller
        await publish_notification_dispatch(
            user_id=str(listing.owner_id),
            event_type="catalog.product.approved",
            channels=["email", "sms", "push"],
            template="listing_approved",
            data={
                "listing_id": str(listing.id),
                "title": listing.title_en,
                "price": f"{listing.price} {listing.currency}",
            },
        )
    except Exception as e:
        # Kafka may not be available, log but don't fail
        import logging
        logging.getLogger("listings_api").warning(f"Failed to publish approval event: {e}")

    # Send listing approved email via marketing automation
    try:
        seller = db.get(User, listing.owner_id)
        if seller:
            await marketing_service.send_event_email(
                session=db,
                user_id=listing.owner_id,
                event_type=EmailEventType.LISTING_APPROVED,
                context={
                    "first_name": seller.full_name.split()[0] if seller.full_name else "Seller",
                    "listing_title": listing.title_en or listing.title,
                    "listing_price": f"{listing.price} {listing.currency}",
                    "listing_link": f"{settings.FRONTEND_URL}/listings/{listing.id}",
                    "shop_link": f"{settings.FRONTEND_URL}/shops/{listing.owner_id}",
                    "share_whatsapp_link": f"https://api.whatsapp.com/send?text={listing.title_en}%20{settings.FRONTEND_URL}/listings/{listing.id}",
                    "share_facebook_link": f"https://www.facebook.com/sharer/sharer.php?u={settings.FRONTEND_URL}/listings/{listing.id}"
                }
            )
    except Exception as e:
        logger.warning(f"Failed to send listing approved marketing email: {e}")

    return {"status": "approved", "listing_id": listing.id, "approved_by_user_id": current_user.id}


@router.post("/{listing_id}/reject")
async def reject_listing(
    listing_id: int,
    rejection_req: ListingRejectionRequest,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Admin or Agent rejects a listing with a reason.

    Requires: is_admin or is_agent role

    Body:
    - reason (str): Rejection reason to show to seller
    - notes (str, optional): Internal moderation notes

    Published Events:
    - catalog.product.rejected → Hide from search, notify seller with reason
    """
    # Check permissions (supports both admin and agent roles)
    _check_approval_permission(current_user)

    if not rejection_req.reason or len(rejection_req.reason.strip()) == 0:
        raise HTTPException(status_code=400, detail="Rejection reason is required")

    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Use CRUD method for rejection
    listing = crud_listing.reject_listing(
        db,
        listing=listing,
        reason=rejection_req.reason,
        rejected_by_user_id=current_user.id,
        notes=rejection_req.notes
    )

    # Recalculate shop's primary category after rejection
    try:
        update_shop_primary_category(db, listing.owner_id)
        cache.delete_pattern("shops:*")
        cache.delete_pattern("public_shops:*")
    except Exception:
        pass

    # Publish Kafka event
    try:
        from app.services.kafka_producer import publish_catalog_event, publish_notification_dispatch

        await publish_catalog_event(
            event_type="product.rejected",
            payload={
                "listing_id": str(listing.id),
                "owner_id": str(listing.owner_id),
                "rejection_reason": reason,
                "rejected_by": current_user.full_name or f"Admin {current_user.id}",
            },
            seller_id=str(listing.owner_id),
        )

        # Notify seller
        await publish_notification_dispatch(
            user_id=str(listing.owner_id),
            event_type="catalog.product.rejected",
            channels=["email", "sms"],
            template="listing_rejected",
            data={
                "listing_id": str(listing.id),
                "title": listing.title_en,
                "rejection_reason": reason,
                "support_contact": "support@suqafuran.com",
            },
        )
    except Exception as e:
        import logging
        logging.getLogger("listings_api").warning(f"Failed to publish rejection event: {e}")

    # Send listing rejected email via marketing automation
    try:
        seller = db.get(User, listing.owner_id)
        if seller:
            await marketing_service.send_event_email(
                session=db,
                user_id=listing.owner_id,
                event_type=EmailEventType.LISTING_REJECTED,
                context={
                    "first_name": seller.full_name.split()[0] if seller.full_name else "Seller",
                    "listing_title": listing.title_en or listing.title,
                    "rejection_reason": rejection_req.reason,
                    "support_email": "support@suqafuran.com",
                    "support_link": f"{settings.FRONTEND_URL}/support"
                }
            )
    except Exception as e:
        logger.warning(f"Failed to send listing rejected marketing email: {e}")

    return {
        "status": "rejected",
        "listing_id": listing.id,
        "reason": rejection_req.reason,
        "rejected_at": listing.rejected_at.isoformat() if listing.rejected_at else None
    }


@router.get("/{listing_id}/moderation-status")
def get_listing_moderation_status(
    listing_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get moderation status of a listing (seller can check their own).
    """
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "listing_id": listing.id,
        "moderation_status": listing.moderation_status,
        "approval_status": listing.approval_status,
        "status": listing.status,
        "moderated_at": listing.moderated_at,
        "rejection_reason": listing.rejection_reason,
        "rejected_at": listing.rejected_at,
        "approved_by_user_id": listing.approved_by_user_id,
        "moderation_notes": listing.moderation_notes if current_user.is_admin else None,
    }


@router.get("/{listing_id}/approval-history")
def get_listing_approval_history(
    listing_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get approval/rejection history for a listing.
    Accessible to: listing owner (seller) or admin/agent.
    """
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Check permission
    if listing.owner_id != current_user.id and not (current_user.is_admin or current_user.is_agent):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get moderator/approver info
    approver_name = None
    if listing.approved_by_user_id:
        from app.models.user import User as UserModel
        approver = db.get(UserModel, listing.approved_by_user_id)
        if approver:
            approver_name = approver.full_name or f"Admin {approver.id}"

    return {
        "listing_id": listing.id,
        "approval_status": listing.approval_status,
        "approval_timeline": {
            "submitted_at": listing.created_at.isoformat() if listing.created_at else None,
            "approved_at": listing.moderated_at.isoformat() if listing.approval_status == "approved" and listing.moderated_at else None,
            "rejected_at": listing.rejected_at.isoformat() if listing.approval_status == "rejected" and listing.rejected_at else None,
        },
        "rejection_reason": listing.rejection_reason if listing.approval_status == "rejected" else None,
        "approved_by": approver_name,
        "moderation_notes": listing.moderation_notes if (current_user.is_admin or current_user.is_agent) else None,
    }


# ============== FEATURED LISTING (PAID AD) ENDPOINTS ==============

@router.post("/{listing_id}/feature")
async def feature_listing(
    listing_id: int,
    boost_level: str,  # "basic", "vip", "diamond"
    payment_method: str,  # "mpesa", "stripe"
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Seller pays to feature a listing (boost visibility).

    Pricing:
    - basic: 5,000 SOS / 30 days
    - vip: 15,000 SOS / 30 days
    - diamond: 50,000 SOS / 30 days

    Published Events:
    - payments.featured_listing.initiated → Send payment prompt
    """
    from app.models.featured_listing import FeaturedListing

    # Validate listing exists and belongs to user
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Listing not owned by you")

    if listing.moderation_status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Listing must be approved before featuring"
        )

    # Pricing map
    PRICING = {
        "basic": {"amount": 5000, "duration": 30},
        "vip": {"amount": 15000, "duration": 30},
        "diamond": {"amount": 50000, "duration": 30},
    }

    if boost_level not in PRICING:
        raise HTTPException(status_code=400, detail="Invalid boost level")

    pricing = PRICING[boost_level]
    amount = pricing["amount"]
    duration_days = pricing["duration"]

    # Create FeaturedListing (payment pending)
    featured = FeaturedListing(
        listing_id=listing_id,
        owner_id=current_user.id,
        boost_level=boost_level,
        amount_paid=amount,
        currency="SOS",
        duration_days=duration_days,
        payment_method=payment_method,
        status="pending",
        payment_status="pending",
    )
    db.add(featured)
    db.commit()
    db.refresh(featured)

    # Publish Kafka event
    try:
        from app.services.kafka_producer import publish_payment_event, publish_notification_dispatch

        await publish_payment_event(
            event_type="featured_listing.payment_initiated",
            payload={
                "featured_listing_id": str(featured.id),
                "listing_id": str(listing_id),
                "boost_level": boost_level,
                "amount": amount,
                "duration_days": duration_days,
            },
            order_id=str(featured.id),
            user_id=str(current_user.id),
        )

        # Send payment prompt
        await publish_notification_dispatch(
            user_id=str(current_user.id),
            event_type="payments.featured_listing.initiated",
            channels=["sms", "push"],
            template="feature_listing_payment_prompt",
            data={
                "listing_title": listing.title_en,
                "boost_level": boost_level,
                "amount": amount,
                "featured_id": str(featured.id),
            },
        )
    except Exception as e:
        import logging
        logging.getLogger("listings_api").warning(f"Failed to publish feature event: {e}")

    return {
        "featured_listing_id": featured.id,
        "status": "pending",
        "payment_required": {
            "amount": amount,
            "currency": "SOS",
            "boost_level": boost_level,
            "duration_days": duration_days,
        },
        "next_step": f"Complete payment via {payment_method}",
    }


@router.post("/webhooks/featured-payment-success")
async def on_featured_listing_payment_success(
    featured_listing_id: int,
    payment_reference: str,
    amount_paid: float,
    *,
    db: Session = Depends(deps.get_db),
    # No payment provider calls this (it has no signature to verify), so it's a
    # manual "mark as paid" action: admins only. Without this anyone could
    # activate a paid boost for free.
    _admin: User = Depends(deps.get_current_admin_only),
) -> Any:
    """
    Webhook called when M-Pesa/Stripe payment succeeds for featured listing.

    Published Events:
    - payments.featured_listing.success → Notify seller, update analytics
    """
    from app.models.featured_listing import FeaturedListing

    featured = db.get(FeaturedListing, featured_listing_id)
    if not featured:
        raise HTTPException(status_code=404, detail="Featured listing not found")

    featured.payment_status = "success"
    featured.status = "active"
    featured.payment_reference = payment_reference
    featured.activated_at = datetime.utcnow()
    featured.expires_at = datetime.utcnow() + timedelta(days=featured.duration_days)
    db.add(featured)

    # Update listing boost level
    listing = db.get(Listing, featured.listing_id)
    boost_map = {"basic": 1, "vip": 2, "diamond": 3}
    listing.boost_level = boost_map.get(featured.boost_level, 0)
    listing.boost_expires_at = featured.expires_at
    db.add(listing)
    db.commit()

    # Publish Kafka event
    try:
        from app.services.kafka_producer import publish_payment_event, publish_notification_dispatch

        await publish_payment_event(
            event_type="featured_listing.payment_success",
            payload={
                "featured_listing_id": str(featured_listing_id),
                "listing_id": str(featured.listing_id),
                "amount": amount_paid,
                "expires_at": featured.expires_at.isoformat(),
            },
            order_id=str(featured_listing_id),
            user_id=str(featured.owner_id),
        )

        # Notify seller
        await publish_notification_dispatch(
            user_id=str(featured.owner_id),
            event_type="payments.featured_listing.success",
            channels=["email", "sms", "push"],
            template="feature_listing_payment_confirmed",
            data={
                "listing_title": listing.title_en,
                "boost_level": featured.boost_level,
                "amount": amount_paid,
                "expires_date": featured.expires_at.strftime("%B %d, %Y"),
            },
        )
    except Exception as e:
        import logging
        logging.getLogger("listings_api").warning(f"Failed to publish success event: {e}")

    return {"status": "activated"}


@router.post("/webhooks/featured-payment-failed")
async def on_featured_listing_payment_failed(
    featured_listing_id: int,
    failure_reason: str,
    *,
    db: Session = Depends(deps.get_db),
    _admin: User = Depends(deps.get_current_admin_only),
) -> Any:
    """
    Webhook called when payment fails for featured listing.

    Published Events:
    - payments.featured_listing.failed → Notify seller to retry
    """
    from app.models.featured_listing import FeaturedListing

    featured = db.get(FeaturedListing, featured_listing_id)
    if not featured:
        raise HTTPException(status_code=404, detail="Featured listing not found")

    featured.payment_status = "failed"
    db.add(featured)
    db.commit()

    # Publish Kafka event
    try:
        from app.services.kafka_producer import publish_payment_event, publish_notification_dispatch

        await publish_payment_event(
            event_type="featured_listing.payment_failed",
            payload={
                "featured_listing_id": str(featured_listing_id),
                "listing_id": str(featured.listing_id),
                "failure_reason": failure_reason,
            },
            order_id=str(featured_listing_id),
            user_id=str(featured.owner_id),
        )

        # Notify seller
        listing = db.get(Listing, featured.listing_id)
        await publish_notification_dispatch(
            user_id=str(featured.owner_id),
            event_type="payments.featured_listing.failed",
            channels=["email", "sms", "push"],
            template="feature_listing_payment_failed",
            data={
                "listing_title": listing.title_en,
                "amount": featured.amount_paid,
                "failure_reason": failure_reason,
            },
        )
    except Exception as e:
        import logging
        logging.getLogger("listings_api").warning(f"Failed to publish failure event: {e}")

    return {"status": "failed", "reason": failure_reason}


# ============== LISTING REPORT ENDPOINT ==============

@router.post("/report")
def report_listing(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    report_in: dict,
) -> Any:
    """
    Report a listing for incorrect information or policy violations.
    """
    from app.models.report import ListingReport

    listing_id = report_in.get("listing_id")
    reason = report_in.get("reason")
    description = report_in.get("description")

    if not listing_id or not reason:
        raise HTTPException(status_code=400, detail="listing_id and reason are required")

    # Verify listing exists
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Prevent self-reporting
    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report your own listing")

    # Check for duplicate recent reports
    from datetime import datetime, timedelta
    recent_report = db.exec(
        select(ListingReport).where(
            ListingReport.listing_id == listing_id,
            ListingReport.reporter_id == current_user.id,
            ListingReport.created_at > datetime.utcnow() - timedelta(days=1)
        )
    ).first()

    if recent_report:
        raise HTTPException(
            status_code=400,
            detail="You have already reported this listing in the past 24 hours"
        )

    # Create report
    report = ListingReport(
        listing_id=listing_id,
        reporter_id=current_user.id,
        reason=reason,
        description=description,
        status="pending"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {"id": report.id, "status": "pending", "message": "Thank you for your report. We will review it shortly."}


@router.get("/admin/find-shop/{shop_handle}")
def find_shop_by_handle(
    shop_handle: str,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Admin endpoint: Find a shop by username/handle.

    Returns shop ID and current primary category.
    """
    shop = db.exec(
        select(User).where(
            (User.phone == shop_handle) |
            (User.business_name.ilike(f"%{shop_handle}%")) |
            (User.full_name.ilike(f"%{shop_handle}%"))
        )
    ).first()

    if not shop:
        raise HTTPException(status_code=404, detail=f"Shop '{shop_handle}' not found")

    return {
        "user_id": shop.id,
        "business_name": shop.business_name or shop.full_name,
        "phone": shop.phone,
        "current_primary_category_id": shop.primary_category_id,
        "is_verified": shop.is_verified
    }


@router.get("/admin/categories")
def list_categories_for_admin(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Admin endpoint: List all categories with their IDs.
    """
    categories = db.exec(select(Category)).all()
    return [
        {
            "id": c.id,
            "name_en": c.name_en,
            "name_so": c.name_so,
            "slug": c.slug
        }
        for c in categories
    ]
