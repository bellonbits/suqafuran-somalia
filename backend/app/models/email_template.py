"""Email template models for marketing automation."""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class EmailTemplateBase(SQLModel):
    """Base email template model."""
    event_type: str = Field(index=True)  # signup, listing_approved, promotional, etc.
    name: str  # Display name
    subject: str
    html_content: str
    text_content: Optional[str] = None
    is_active: bool = Field(default=True)
    description: Optional[str] = None  # doubles as the subtitle for promotional templates
    variables: Optional[str] = None  # JSON list of template variables
    action_text: Optional[str] = None  # CTA button label (promotional templates)
    action_url: Optional[str] = None  # CTA button link (promotional templates)


class EmailTemplate(EmailTemplateBase, table=True):
    """Email template stored in database."""
    __tablename__ = "email_template"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    updated_by: Optional[int] = Field(default=None, foreign_key="user.id")


class EmailTemplateCreate(EmailTemplateBase):
    """Create email template request."""
    pass


class EmailTemplateUpdate(SQLModel):
    """Update email template request."""
    name: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    variables: Optional[str] = None
    action_text: Optional[str] = None
    action_url: Optional[str] = None


class EmailTemplateRead(EmailTemplateBase):
    """Email template response."""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None


class EmailTemplatePreview(SQLModel):
    """Email template preview with rendered content."""
    id: int
    event_type: str
    name: str
    subject: str
    html_content: str
    variables: list[str]
