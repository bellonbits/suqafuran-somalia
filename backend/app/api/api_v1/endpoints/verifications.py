from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, File, UploadFile, Form
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from app.api import deps
from app.models.user import User
from app.models.verification import (
    VerificationRequest,
    VerificationStatus,
    VerificationRequestRead
)
from app.services.storage_service import storage_service

router = APIRouter()

@router.post("/apply", response_model=VerificationRequest)
async def apply_for_verification(
    *,
    db: Session = Depends(deps.get_db),
    # verification_in: VerificationRequestBase, # Cannot use Pydantic model with Form/File mix easily in FastAPI
    document_type: str = Form(...),
    id_number: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    document_files: List[UploadFile] = File(...),
    selfie_file: UploadFile = File(...),
    tier: str = Form("tier2"),
    proof_of_address_file: Optional[UploadFile] = File(None),
    video_selfie_file: Optional[UploadFile] = File(None),
    facial_match_score: float = Form(0.0),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Submit a verification request with ID documents and a selfie."""

    existing = db.exec(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == current_user.id)
        .where(VerificationRequest.status == VerificationStatus.PENDING)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A verification request is already pending")

    # Upload document files via storage_service (Cloudinary)
    document_urls = []
    for file in document_files:
        if not file.filename:
            continue
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext not in ["jpg", "jpeg", "png", "pdf"]:
            continue
        content = await file.read()
        url, _ = await storage_service.upload_file(content, file.filename)
        document_urls.append(url)

    if not document_urls:
        raise HTTPException(status_code=400, detail="No valid document files uploaded")

    # Upload selfie via storage_service (Cloudinary)
    selfie_content = await selfie_file.read()
    selfie_url, _ = await storage_service.upload_file(
        selfie_content, selfie_file.filename or "selfie.jpg"
    )

    # Proof of Address
    address_url = None
    if proof_of_address_file:
        content = await proof_of_address_file.read()
        address_url, _ = await storage_service.upload_file(content, proof_of_address_file.filename or "address.pdf")

    # Video Selfie
    video_url = None
    if video_selfie_file:
        content = await video_selfie_file.read()
        video_url, _ = await storage_service.upload_file(content, video_selfie_file.filename or "video.mp4")

    db_obj = VerificationRequest(
        user_id=current_user.id,
        document_type=document_type,
        id_number=id_number,
        tier=tier,
        notes=notes,
        status=VerificationStatus.PENDING,
        document_urls=document_urls,
        selfie_url=selfie_url,
        proof_of_address_url=address_url,
        video_selfie_url=video_url,
        facial_match_score=facial_match_score,
        auto_verification_status="manual_review"
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.get("/me", response_model=Optional[VerificationRequest])
def get_my_verification_status(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user's verification status.
    """
    return db.exec(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == current_user.id)
        .order_by(VerificationRequest.created_at.desc())
    ).first()

@router.get("/stats")
def get_verification_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """(Admin) Counts for the Seller Verifications summary cards."""
    from sqlmodel import func

    pending = db.exec(select(func.count(VerificationRequest.id)).where(VerificationRequest.status == VerificationStatus.PENDING)).one()
    approved = db.exec(select(func.count(VerificationRequest.id)).where(VerificationRequest.status == VerificationStatus.APPROVED)).one()
    rejected = db.exec(select(func.count(VerificationRequest.id)).where(VerificationRequest.status == VerificationStatus.REJECTED)).one()
    suspended_sellers = db.exec(
        select(func.count(User.id)).where(User.is_suspended == True, User.business_name.isnot(None))  # noqa: E712
    ).one()
    return {
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "suspended_sellers": suspended_sellers,
        "total": pending + approved + rejected,
    }


@router.get("/", response_model=List[VerificationRequestRead])
def list_verification_requests(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    status: Optional[VerificationStatus] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 1000,
) -> Any:
    """
    (Admin) List all verification requests, with the requester's profile
    and (if reviewed) who reviewed it and when -- recovered from AuditLog
    since VerificationRequest itself doesn't carry a reviewer column.
    """
    from app.models.audit import AuditLog

    query = select(VerificationRequest)
    if status:
        query = query.where(VerificationRequest.status == status)

    requests = db.exec(query.order_by(VerificationRequest.created_at.desc()).offset(skip).limit(limit)).all()

    user_ids = [req.user_id for req in requests]
    users = {}
    if user_ids:
        user_list = db.exec(select(User).where(User.id.in_(user_ids))).all()
        users = {u.id: u for u in user_list}

    # Most recent VERIFICATION_STATUS_UPDATE audit entry per request, to
    # surface "reviewed by / reviewed at" without a schema change.
    reviewer_by_request: dict = {}
    if requests:
        request_ids = [req.id for req in requests]
        audit_rows = db.exec(
            select(AuditLog)
            .where(AuditLog.action == "VERIFICATION_STATUS_UPDATE", AuditLog.resource_id.in_(request_ids))
            .order_by(AuditLog.timestamp.desc())
        ).all()
        reviewer_ids = {row.user_id for row in audit_rows}
        reviewers = {u.id: u for u in db.exec(select(User).where(User.id.in_(reviewer_ids))).all()} if reviewer_ids else {}
        for row in audit_rows:
            if row.resource_id not in reviewer_by_request:
                reviewer = reviewers.get(row.user_id)
                reviewer_by_request[row.resource_id] = {
                    "reviewed_by": reviewer.full_name if reviewer else f"Admin #{row.user_id}",
                    "reviewed_at": row.timestamp,
                }

    result = []
    for req in requests:
        user = users.get(req.user_id)
        if search and user:
            term = search.lower()
            haystack = " ".join(filter(None, [user.full_name, user.business_name, user.email, user.phone])).lower()
            if term not in haystack:
                continue
        data = req.dict()
        if user:
            data["user"] = {
                "full_name": user.full_name,
                "business_name": user.business_name,
                "phone": user.phone,
                "email": user.email,
                "location": user.location,
                "is_verified": user.is_verified,
                "is_suspended": user.is_suspended,
                "avatar_url": user.avatar_url,
            }
        data.update(reviewer_by_request.get(req.id, {"reviewed_by": None, "reviewed_at": None}))
        result.append(data)
    return result

@router.patch("/{id}", response_model=VerificationRequest)
def update_verification_status(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    id: int,
    status: VerificationStatus = Body(...),
    notes: Optional[str] = Body(None),
) -> Any:
    """
    (Admin) Approve or reject a verification request.
    """
    from app.models.audit import AuditLog

    request = db.get(VerificationRequest, id)
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")

    request.status = status
    if notes is not None:
        request.notes = notes
    db.add(request)

    # If approved, update user's verification status
    if status == VerificationStatus.APPROVED:
        from app.models.user import UserVerifiedLevel
        user = db.get(User, request.user_id)
        if user:
            user.is_verified = True
            # Map request tier to UserVerifiedLevel
            if request.tier == "premium":
                user.verified_level = UserVerifiedLevel.premium
            elif request.tier == "tier3":
                user.verified_level = UserVerifiedLevel.tier3
            else:
                user.verified_level = UserVerifiedLevel.tier2
            db.add(user)

    db.add(AuditLog(
        user_id=current_user.id,
        action="VERIFICATION_STATUS_UPDATE",
        resource_type="verification_request",
        resource_id=id,
        details=f"Status set to {status.value}" + (f" -- {notes}" if notes else "")
    ))

    db.commit()
    db.refresh(request)
    return request


@router.post("/{id}/request-info")
def request_more_information(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    id: int,
    message: str = Body(..., embed=True),
) -> Any:
    """
    (Admin) Ask the seller for more information -- stays pending, note is
    recorded and appended so a second reviewer can see what was already
    requested. Does not currently email the seller; the note is visible to
    them the next time they check their verification status in-app.
    """
    from app.models.audit import AuditLog

    request = db.get(VerificationRequest, id)
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")

    request.notes = f"{request.notes}\n---\nMore info requested: {message}" if request.notes else f"More info requested: {message}"
    request.status = VerificationStatus.PENDING
    db.add(request)
    db.add(AuditLog(
        user_id=current_user.id,
        action="VERIFICATION_REQUEST_INFO",
        resource_type="verification_request",
        resource_id=id,
        details=message,
    ))
    db.commit()
    db.refresh(request)
    return request


@router.post("/{id}/reverify")
def reverify_seller(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    id: int,
) -> Any:
    """(Admin) Send an approved/rejected request back to pending for a fresh review."""
    from app.models.audit import AuditLog

    request = db.get(VerificationRequest, id)
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")

    request.status = VerificationStatus.PENDING
    db.add(request)
    db.add(AuditLog(
        user_id=current_user.id,
        action="VERIFICATION_REVERIFY",
        resource_type="verification_request",
        resource_id=id,
        details="Reset to pending for re-review",
    ))
    db.commit()
    db.refresh(request)
    return request


@router.post("/{id}/suspend-seller")
def suspend_seller(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    id: int,
    reason: Optional[str] = Body(None, embed=True),
) -> Any:
    """(Admin) Suspend the seller tied to this verification request."""
    from app.models.audit import AuditLog

    request = db.get(VerificationRequest, id)
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")

    user = db.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Seller not found")

    user.is_suspended = True
    db.add(user)
    db.add(AuditLog(
        user_id=current_user.id,
        action="SELLER_SUSPENDED",
        resource_type="user",
        resource_id=user.id,
        details=reason or "Suspended from verification review",
    ))
    db.commit()
    return {"user_id": user.id, "is_suspended": True}


@router.post("/{id}/reactivate-seller")
def reactivate_seller(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
    id: int,
) -> Any:
    """(Admin) Lift a suspension on the seller tied to this verification request."""
    from app.models.audit import AuditLog

    request = db.get(VerificationRequest, id)
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")

    user = db.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Seller not found")

    user.is_suspended = False
    db.add(user)
    db.add(AuditLog(
        user_id=current_user.id,
        action="SELLER_REACTIVATED",
        resource_type="user",
        resource_id=user.id,
        details="Suspension lifted from verification review",
    ))
    db.commit()
    return {"user_id": user.id, "is_suspended": False}
