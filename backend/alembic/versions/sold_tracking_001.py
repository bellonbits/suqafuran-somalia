"""add sold tracking fields to listing

Revision ID: sold_tracking_001
Revises: otp_log_001
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = 'sold_tracking_001'
down_revision = 'otp_log_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('listing', sa.Column('is_sold', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('listing', sa.Column('sold_at', sa.DateTime(), nullable=True))
    op.add_column('listing', sa.Column('sold_via', sa.String(), nullable=True))
    op.create_index('ix_listing_is_sold', 'listing', ['is_sold'])


def downgrade():
    op.drop_index('ix_listing_is_sold', table_name='listing')
    op.drop_column('listing', 'sold_via')
    op.drop_column('listing', 'sold_at')
    op.drop_column('listing', 'is_sold')
