"""Add composite indexes for performance optimization

Revision ID: perf_001
Revises: saved_address_001
Create Date: 2026-07-06 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'perf_001'
down_revision = 'saved_address_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for admin/shops query: JOIN user with listing WHERE status = 'active'
    op.create_index(
        'ix_listing_status_owner_id',
        'listing',
        ['status', 'owner_id'],
        unique=False
    )

    # Index for getting category stats
    op.create_index(
        'ix_listing_category_owner_id',
        'listing',
        ['category_id', 'owner_id'],
        unique=False
    )

    # Index for filtering by status and category
    op.create_index(
        'ix_listing_status_category_id',
        'listing',
        ['status', 'category_id'],
        unique=False
    )

    # Note: business_name column doesn't exist in current schema, skip this index
    # Index for user verification and active status
    op.create_index(
        'ix_user_is_verified_is_active',
        'user',
        ['is_verified', 'is_active'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_user_is_verified_is_active', table_name='user')
    op.drop_index('ix_listing_status_category_id', table_name='listing')
    op.drop_index('ix_listing_category_owner_id', table_name='listing')
    op.drop_index('ix_listing_status_owner_id', table_name='listing')
