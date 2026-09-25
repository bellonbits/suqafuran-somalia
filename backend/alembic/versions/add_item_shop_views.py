"""Add item and shop view tracking tables for analytics.

Revision ID: add_analytics_views_001
Revises: add_review_001
Create Date: 2026-07-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'add_analytics_views_001'
down_revision = 'add_review_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'item_view',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('device_type', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('referrer', sa.String(), nullable=True),
        sa.Column('viewed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_item_view_listing_id', 'listing_id'),
        sa.Index('ix_item_view_user_id', 'user_id'),
        sa.Index('ix_item_view_viewed_at', 'viewed_at'),
    )

    op.create_table(
        'shop_view',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('shop_owner_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('device_type', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('referrer', sa.String(), nullable=True),
        sa.Column('viewed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['shop_owner_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_shop_view_shop_owner_id', 'shop_owner_id'),
        sa.Index('ix_shop_view_user_id', 'user_id'),
        sa.Index('ix_shop_view_viewed_at', 'viewed_at'),
    )


def downgrade() -> None:
    op.drop_table('shop_view')
    op.drop_table('item_view')
