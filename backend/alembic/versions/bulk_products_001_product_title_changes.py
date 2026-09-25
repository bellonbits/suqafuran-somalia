"""Create product title changes table for Phase 6 Bulk Product Management.

Revision ID: bulk_products_001
Revises: monitoring_001
Create Date: 2026-07-18 07:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bulk_products_001'
down_revision = 'monitoring_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create product_title_changes table for audit trail
    op.create_table(
        'product_title_changes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.String(255), nullable=False, index=True),
        sa.Column('old_title', sa.String(512), nullable=False),
        sa.Column('new_title', sa.String(512), nullable=False),
        sa.Column('changed_at', sa.DateTime(), nullable=False, index=True, server_default=sa.func.now()),
        sa.Column('changed_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['changed_by'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('product_title_changes')
