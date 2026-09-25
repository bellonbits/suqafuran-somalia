"""Add CTA button fields to email_template for promotional/campaign templates.

Revision ID: 0016_promo_template_fields
Revises: 0015_add_customer_segments
Create Date: 2026-08-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0016_promo_template_fields'
down_revision = '0015_add_customer_segments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS: this repo's alembic_version history has pre-existing
    # unresolved heads/mismatched stamps, so these columns may already have
    # been applied directly against production ahead of a clean upgrade run.
    op.execute("ALTER TABLE email_template ADD COLUMN IF NOT EXISTS action_text VARCHAR")
    op.execute("ALTER TABLE email_template ADD COLUMN IF NOT EXISTS action_url VARCHAR")


def downgrade() -> None:
    op.execute("ALTER TABLE email_template DROP COLUMN IF EXISTS action_url")
    op.execute("ALTER TABLE email_template DROP COLUMN IF EXISTS action_text")
