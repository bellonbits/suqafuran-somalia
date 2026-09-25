"""Prevent duplicate active sellers per user

Revision ID: prevent_duplicate_sellers
Revises:
Create Date: 2026-07-15 10:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'prevent_duplicate_sellers'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # TODO: sellers table doesn't exist yet in current schema
    # This constraint will be added once sellers table is created
    pass


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_sellers_user_id_active")
