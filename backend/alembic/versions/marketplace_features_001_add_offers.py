"""Add Offer model for marketplace negotiations

Revision ID: marketplace_001
Revises:
Create Date: 2026-07-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'marketplace_001'
down_revision = 'seller_profile_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create offer table
    op.create_table(
        'offer',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('buyer_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('message', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['buyer_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_offer_listing_id'), 'offer', ['listing_id'], unique=False)
    op.create_index(op.f('ix_offer_buyer_id'), 'offer', ['buyer_id'], unique=False)
    op.create_index(op.f('ix_offer_status'), 'offer', ['status'], unique=False)
    op.create_index(op.f('ix_offer_created_at'), 'offer', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_offer_created_at'), table_name='offer')
    op.drop_index(op.f('ix_offer_status'), table_name='offer')
    op.drop_index(op.f('ix_offer_buyer_id'), table_name='offer')
    op.drop_index(op.f('ix_offer_listing_id'), table_name='offer')
    op.drop_table('offer')
