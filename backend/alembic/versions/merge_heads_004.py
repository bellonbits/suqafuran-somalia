"""Merge migration heads

Revision ID: merge_heads_004
Revises: prevent_duplicate_sellers, shop_mgmt_001, 59ee1dc2a297
Create Date: 2026-07-22 14:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_004'
down_revision = ('prevent_duplicate_sellers', 'shop_mgmt_001', '59ee1dc2a297')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
