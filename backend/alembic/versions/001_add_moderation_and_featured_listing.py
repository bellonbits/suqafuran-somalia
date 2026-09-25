"""Add moderation fields to Listing and create FeaturedListing table

Revision ID: 001_moderation_featured
Revises: merge_heads_001
Create Date: 2026-07-15 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_moderation_featured'
down_revision = 'merge_heads_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add moderation fields to listing table
    op.add_column('listing', sa.Column('moderation_status', sa.String(50), nullable=False, server_default='pending', index=True))
    op.add_column('listing', sa.Column('moderated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('listing', sa.Column('moderator_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True))
    op.add_column('listing', sa.Column('moderation_notes', sa.String(500), nullable=True))

    # Create featured_listing table
    op.create_table(
        'featured_listing',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), sa.ForeignKey('listing.id'), nullable=False, index=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False, index=True),
        sa.Column('boost_level', sa.String(50), nullable=False, index=True),
        sa.Column('amount_paid', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='SOS'),
        sa.Column('duration_days', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending', index=True),
        sa.Column('payment_status', sa.String(50), nullable=False, server_default='pending', index=True),
        sa.Column('payment_method', sa.String(50), nullable=False),
        sa.Column('payment_reference', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('impressions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('clicks', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('idx_featured_listing_status', 'featured_listing', ['status', 'expires_at'])
    op.create_index('idx_listing_moderation', 'listing', ['moderation_status', 'created_at'])


def downgrade():
    # Drop featured_listing table
    op.drop_index('idx_featured_listing_status', table_name='featured_listing')
    op.drop_table('featured_listing')

    # Remove moderation fields from listing table
    op.drop_column('listing', 'moderation_notes')
    op.drop_column('listing', 'moderator_id')
    op.drop_column('listing', 'moderated_at')
    op.drop_column('listing', 'moderation_status')

    op.drop_index('idx_listing_moderation', table_name='listing')
