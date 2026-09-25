from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session
from app.api import deps
from app.crud import crud_content
from app.models.site_content import SiteContent, SiteContentRead, SiteContentUpdate
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=Dict[str, Dict[str, str]])
def read_content_overrides(
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Retrieve all site content as a dictionary for i18next overrides.
    Returns: { "en": { "key": "val" }, "so": { "key": "val" } }
    """
    contents = crud_content.get_site_content(db)
    overrides = {
        "en": {},
        "so": {}
    }
    for item in contents:
        if item.value_en:
            overrides["en"][item.key] = item.value_en
        if item.value_so:
            overrides["so"][item.key] = item.value_so
    return overrides


@router.get("/all", response_model=List[SiteContentRead])
def read_all_content(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Retrieve all site content (Admin only).
    """
    return crud_content.get_site_content(db)


@router.patch("/{key}", response_model=SiteContentRead)
def update_content(
    *,
    db: Session = Depends(deps.get_db),
    key: str,
    content_in: SiteContentUpdate,
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Update site content by key (Admin only).
    """
    db_obj = crud_content.get_content_by_key(db, key=key)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Content key not found")
    return crud_content.update_site_content(db=db, db_obj=db_obj, content_in=content_in)


@router.post("/sync", response_model=Dict[str, int])
def sync_content(
    *,
    db: Session = Depends(deps.get_db),
    content_map: Dict[str, Dict[str, str]], # { "key": { "en": "...", "so": "..." } }
    page_group: str = "general",
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Bulk import/sync content keys from a map (Admin only).
    """
    count = 0
    for key, values in content_map.items():
        db_obj = crud_content.get_content_by_key(db, key=key)
        if db_obj:
            # Update existing
            crud_content.update_site_content(
                db=db, 
                db_obj=db_obj, 
                content_in=SiteContentUpdate(
                    value_en=values.get("en"), 
                    value_so=values.get("so")
                )
            )
        else:
            # Create new
            crud_content.create_site_content(
                db=db,
                content_in=SiteContent(
                    key=key,
                    value_en=values.get("en", ""),
                    value_so=values.get("so"),
                    page_group=page_group
                )
            )
        count += 1
    return {"synced": count}


@router.get("/version")
def read_system_version() -> Any:
    """
    Retrieve the latest platform app versions and store URLs.
    """
    return {
        "latest_android_version": "1.6.3",
        "latest_ios_version": "1.6.3",
        "android_store_url": "https://play.google.com/store/apps/details?id=com.suqafuran.app",
        "ios_store_url": "https://apps.apple.com/app/suqafuran/id1669472390"
    }


@router.get("/email/track-open")
def track_email_open(token: str, request: Request, db: Session = Depends(deps.get_db)) -> Any:
    """
    Tracks email open rate via a transparent pixel.
    Captures IP, User Agent, and handles duplicate opens safely without double-triggering.
    """
    from app.models.email_log import EmailLog
    from datetime import datetime
    import base64
    from fastapi.responses import Response
    import json

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    log_entry = db.query(EmailLog).filter(EmailLog.tracking_token == token).first()
    if log_entry:
        # Check current status and update opened timestamp if not already opened/clicked
        meta = {}
        if log_entry.metadata_json:
            try:
                meta = json.loads(log_entry.metadata_json)
            except Exception:
                meta = {}
        
        # Track active hits and IPs in metadata list
        if "hits" not in meta:
            meta["hits"] = []
        meta["hits"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "ip": client_ip,
            "user_agent": user_agent,
            "action": "open"
        })
        log_entry.metadata_json = json.dumps(meta)

        if log_entry.status not in ["opened", "clicked", "unsubscribed"]:
            log_entry.status = "opened"
            log_entry.opened_at = datetime.utcnow()
        
        db.add(log_entry)
        db.commit()

    # Tiny 1x1 transparent GIF
    pixel_data = base64.b64decode(b"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel_data, media_type="image/gif")


@router.get("/email/track-click")
def track_email_click(token: str, redirect_url: str, request: Request, db: Session = Depends(deps.get_db)) -> Any:
    """
    Tracks email clicks (CTR) and redirects user to secure target destination safely.
    """
    from app.models.email_log import EmailLog
    from datetime import datetime
    from fastapi.responses import RedirectResponse
    import json

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    log_entry = db.query(EmailLog).filter(EmailLog.tracking_token == token).first()
    if log_entry:
        meta = {}
        if log_entry.metadata_json:
            try:
                meta = json.loads(log_entry.metadata_json)
            except Exception:
                meta = {}

        if "hits" not in meta:
            meta["hits"] = []
        meta["hits"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "ip": client_ip,
            "user_agent": user_agent,
            "action": "click",
            "redirect_url": redirect_url
        })
        log_entry.metadata_json = json.dumps(meta)

        if log_entry.status != "unsubscribed":
            log_entry.status = "clicked"
            if not log_entry.clicked_at:
                log_entry.clicked_at = datetime.utcnow()
            if not log_entry.opened_at:
                log_entry.opened_at = datetime.utcnow() # Safe assumption: opened before clicked

        db.add(log_entry)
        db.commit()

    # Secure redirect to the absolute URL
    return RedirectResponse(url=redirect_url)
