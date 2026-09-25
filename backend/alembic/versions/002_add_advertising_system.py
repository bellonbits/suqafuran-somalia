"""Add comprehensive advertising system with placement types, homepage banners, and analytics.

Revision ID: 002
Revises: 001_add_moderation_and_featured_listing
Create Date: 2026-07-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_advertising_system'
down_revision = 'add_shop_logo'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create advertising system tables."""

    # Create advertising_plan table
    op.create_table(
        'advertising_plan',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('placement_type', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('price_per_day', sa.Float(), nullable=True),
        sa.Column('price_per_week', sa.Float(), nullable=True),
        sa.Column('price_per_month', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(
        'ix_advertising_plan_placement_type',
        'advertising_plan',
        ['placement_type'],
    )
    op.create_index(
        'ix_advertising_plan_is_active',
        'advertising_plan',
        ['is_active'],
    )

    # Create advertisement table
    op.create_table(
        'advertisement',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('placement_type', sa.String(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('amount_paid', sa.Float(), nullable=False),
        sa.Column('payment_reference', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['seller_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['plan_id'], ['advertising_plan.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_advertisement_seller_id', 'advertisement', ['seller_id'])
    op.create_index('ix_advertisement_listing_id', 'advertisement', ['listing_id'])
    op.create_index('ix_advertisement_plan_id', 'advertisement', ['plan_id'])
    op.create_index('ix_advertisement_placement_type', 'advertisement', ['placement_type'])
    op.create_index('ix_advertisement_start_date', 'advertisement', ['start_date'])
    op.create_index('ix_advertisement_end_date', 'advertisement', ['end_date'])
    op.create_index('ix_advertisement_status', 'advertisement', ['status'])
    op.create_index('ix_advertisement_created_at', 'advertisement', ['created_at'])

    # Create advertisement_stats table
    op.create_table(
        'advertisement_stats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('advertisement_id', sa.Integer(), nullable=False),
        sa.Column('impressions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('clicks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['advertisement_id'], ['advertisement.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('advertisement_id'),
    )
    op.create_index('ix_advertisement_stats_advertisement_id', 'advertisement_stats', ['advertisement_id'])

    # Create homepage_banner table
    op.create_table(
        'homepage_banner',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('subtitle', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('mobile_image_url', sa.String(), nullable=True),
        sa.Column('button_text', sa.String(), nullable=False, server_default='Shop Now'),
        sa.Column('button_link', sa.String(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('created_by_admin_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['seller_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['created_by_admin_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_homepage_banner_seller_id', 'homepage_banner', ['seller_id'])
    op.create_index('ix_homepage_banner_start_date', 'homepage_banner', ['start_date'])
    op.create_index('ix_homepage_banner_end_date', 'homepage_banner', ['end_date'])
    op.create_index('ix_homepage_banner_status', 'homepage_banner', ['status'])
    op.create_index('ix_homepage_banner_created_at', 'homepage_banner', ['created_at'])

    # Create homepage_banner_stats table
    op.create_table(
        'homepage_banner_stats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('banner_id', sa.Integer(), nullable=False),
        sa.Column('impressions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('clicks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['banner_id'], ['homepage_banner.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('banner_id'),
    )
    op.create_index('ix_homepage_banner_stats_banner_id', 'homepage_banner_stats', ['banner_id'])


def downgrade() -> None:
    """Drop advertising system tables."""
    op.drop_index('ix_homepage_banner_stats_banner_id', table_name='homepage_banner_stats')
    op.drop_table('homepage_banner_stats')
    op.drop_index('ix_homepage_banner_created_at', table_name='homepage_banner')
    op.drop_index('ix_homepage_banner_status', table_name='homepage_banner')
    op.drop_index('ix_homepage_banner_end_date', table_name='homepage_banner')
    op.drop_index('ix_homepage_banner_start_date', table_name='homepage_banner')
    op.drop_index('ix_homepage_banner_shop_id', table_name='homepage_banner')
    op.drop_table('homepage_banner')
    op.drop_index('ix_advertisement_stats_advertisement_id', table_name='advertisement_stats')
    op.drop_table('advertisement_stats')
    op.drop_index('ix_advertisement_created_at', table_name='advertisement')
    op.drop_index('ix_advertisement_status', table_name='advertisement')
    op.drop_index('ix_advertisement_end_date', table_name='advertisement')
    op.drop_index('ix_advertisement_start_date', table_name='advertisement')
    op.drop_index('ix_advertisement_placement_type', table_name='advertisement')
    op.drop_index('ix_advertisement_plan_id', table_name='advertisement')
    op.drop_index('ix_advertisement_listing_id', table_name='advertisement')
    op.drop_index('ix_advertisement_shop_id', table_name='advertisement')
    op.drop_table('advertisement')
    op.drop_index('ix_advertising_plan_is_active', table_name='advertising_plan')
    op.drop_index('ix_advertising_plan_placement_type', table_name='advertising_plan')
    op.drop_table('advertising_plan')
