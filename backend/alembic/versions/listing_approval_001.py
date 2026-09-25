"""Add listing approval workflow fields.

Revision ID: listing_approval_001
Revises: 20260722_add_attrs_schema
Create Date: 2026-07-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'listing_approval_001'
down_revision = '20260722_add_attrs_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL to add columns safely
    op.execute(text('ALTER TABLE listing ADD COLUMN IF NOT EXISTS approval_status VARCHAR NOT NULL DEFAULT \'pending\''))
    op.execute(text('ALTER TABLE listing ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER'))
    op.execute(text('ALTER TABLE listing ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP'))

    # Create index
    op.execute(text('CREATE INDEX IF NOT EXISTS ix_listing_approval_status ON listing(approval_status)'))

    # Add foreign key if it doesn't exist
    try:
        op.execute(text('ALTER TABLE listing ADD CONSTRAINT fk_listing_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES "user"(id) ON DELETE SET NULL'))
    except:
        pass  # Constraint may already exist


def downgrade() -> None:
    op.execute(text('ALTER TABLE listing DROP CONSTRAINT IF EXISTS fk_listing_approved_by'))
    op.execute(text('DROP INDEX IF EXISTS ix_listing_approval_status'))
    op.execute(text('ALTER TABLE listing DROP COLUMN IF EXISTS rejected_at'))
    op.execute(text('ALTER TABLE listing DROP COLUMN IF EXISTS approved_by_user_id'))
    op.execute(text('ALTER TABLE listing DROP COLUMN IF EXISTS approval_status'))
