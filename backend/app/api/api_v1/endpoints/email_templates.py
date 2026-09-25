"""Admin endpoints for managing email templates."""

from typing import Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from jinja2 import Template
import json
import re

from app.api import deps
from app.models.user import User
from app.models.email_template import (
    EmailTemplate, EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateRead
)
from app.core.logging_config import get_logger

logger = get_logger("email_templates")

router = APIRouter()


class EmailTemplatePreviewRequest(BaseModel):
    html_content: str
    variables: dict[str, str]


def _check_admin_permission(current_user: User):
    """Verify user has admin permission."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage email templates"
        )


def _extract_template_variables(content: str) -> list[str]:
    """Extract Jinja2 template variables from content."""
    try:
        # Find all {{ variable }} patterns
        pattern = r'\{\{(?:\s*)([a-zA-Z_][a-zA-Z0-9_.]*)(?:\s*)\}\}'
        matches = set(re.findall(pattern, content))
        return sorted(list(matches))
    except Exception as e:
        logger.warning(f"Failed to extract variables: {e}")
        return []


@router.get("/", response_model=list[EmailTemplateRead])
def list_email_templates(
    event_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List email templates with optional filtering."""
    _check_admin_permission(current_user)

    query = select(EmailTemplate)

    if event_type:
        query = query.where(EmailTemplate.event_type == event_type)
    if is_active is not None:
        query = query.where(EmailTemplate.is_active == is_active)

    templates = db.exec(query.order_by(EmailTemplate.event_type)).all()
    return templates


@router.get("/{template_id}", response_model=EmailTemplateRead)
def get_email_template(
    template_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get a specific email template."""
    _check_admin_permission(current_user)

    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/", response_model=EmailTemplateRead)
def create_email_template(
    template_in: EmailTemplateCreate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create a new email template."""
    _check_admin_permission(current_user)

    # Check if template for this event_type already exists
    existing = db.exec(
        select(EmailTemplate).where(EmailTemplate.event_type == template_in.event_type)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Template for event type '{template_in.event_type}' already exists"
        )

    # Extract variables from templates
    variables = _extract_template_variables(template_in.html_content)
    if template_in.text_content:
        variables.extend(_extract_template_variables(template_in.text_content))
    variables = sorted(list(set(variables)))

    template = EmailTemplate(
        **template_in.dict(exclude={"variables"}),
        variables=json.dumps(variables),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    logger.info(f"Created email template: {template.event_type} (ID: {template.id})")
    return template


@router.put("/{template_id}", response_model=EmailTemplateRead)
def update_email_template(
    template_id: int,
    template_in: EmailTemplateUpdate,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update an email template."""
    _check_admin_permission(current_user)

    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Update fields
    update_data = template_in.dict(exclude_unset=True)

    # Re-extract variables if content changed
    if "html_content" in update_data or "text_content" in update_data:
        html = update_data.get("html_content", template.html_content)
        text = update_data.get("text_content", template.text_content)

        variables = _extract_template_variables(html)
        if text:
            variables.extend(_extract_template_variables(text))
        variables = sorted(list(set(variables)))

        update_data["variables"] = json.dumps(variables)

    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = current_user.id

    for field, value in update_data.items():
        setattr(template, field, value)

    db.add(template)
    db.commit()
    db.refresh(template)

    logger.info(f"Updated email template: {template.event_type} (ID: {template.id})")
    return template


@router.delete("/{template_id}")
def delete_email_template(
    template_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete an email template (soft delete by marking inactive)."""
    _check_admin_permission(current_user)

    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Soft delete by marking inactive
    template.is_active = False
    template.updated_at = datetime.utcnow()
    template.updated_by = current_user.id
    db.add(template)
    db.commit()

    logger.info(f"Deactivated email template: {template.event_type} (ID: {template.id})")
    return {"status": "deleted", "id": template_id}


@router.post("/{template_id}/preview")
def preview_email_template(
    template_id: int,
    preview_data: EmailTemplatePreviewRequest,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Preview email template with sample data."""
    _check_admin_permission(current_user)

    try:
        # Render template with provided variables
        html_template = Template(preview_data.html_content)
        rendered_html = html_template.render(**preview_data.variables)

        return {
            "status": "success",
            "html": rendered_html,
            "variables_used": list(preview_data.variables.keys())
        }
    except Exception as e:
        logger.error(f"Failed to render template preview: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template rendering failed: {str(e)}"
        )


@router.post("/{template_id}/restore")
def restore_email_template(
    template_id: int,
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Restore a deactivated email template."""
    _check_admin_permission(current_user)

    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.is_active = True
    template.updated_at = datetime.utcnow()
    template.updated_by = current_user.id
    db.add(template)
    db.commit()
    db.refresh(template)

    logger.info(f"Restored email template: {template.event_type} (ID: {template.id})")
    return template
