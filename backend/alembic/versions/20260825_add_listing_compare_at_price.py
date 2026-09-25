"""Add compare_at_price to listing

Revision ID: 20260825_compare_at_price
Revises: broadcast_job_001
Create Date: 2026-08-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260825_compare_at_price'
down_revision = 'broadcast_job_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('listing', sa.Column('compare_at_price', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('listing', 'compare_at_price')
