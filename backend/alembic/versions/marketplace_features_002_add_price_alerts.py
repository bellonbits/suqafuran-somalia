"""Add PriceAlert model for price tracking

Revision ID: marketplace_002
Revises: marketplace_001
Create Date: 2026-07-24 10:05:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'marketplace_002'
down_revision = 'marketplace_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create price_alert table
    op.create_table(
        'pricealert',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('target_price', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_notified_at', sa.DateTime(), nullable=True),
        sa.Column('last_price', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pricealert_listing_id'), 'pricealert', ['listing_id'], unique=False)
    op.create_index(op.f('ix_pricealert_user_id'), 'pricealert', ['user_id'], unique=False)
    op.create_index(op.f('ix_pricealert_is_active'), 'pricealert', ['is_active'], unique=False)
    op.create_index(op.f('ix_pricealert_created_at'), 'pricealert', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_pricealert_created_at'), table_name='pricealert')
    op.drop_index(op.f('ix_pricealert_is_active'), table_name='pricealert')
    op.drop_index(op.f('ix_pricealert_user_id'), table_name='pricealert')
    op.drop_index(op.f('ix_pricealert_listing_id'), table_name='pricealert')
    op.drop_table('pricealert')
