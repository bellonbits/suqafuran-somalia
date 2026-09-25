"""merge heads 003

Revision ID: merge_heads_003
Revises: sold_tracking_001, anti_scam_init_001
Create Date: 2026-06-20 07:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_003'
down_revision = ('sold_tracking_001', 'anti_scam_init_001')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
