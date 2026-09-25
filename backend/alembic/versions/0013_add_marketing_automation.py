"""Add marketing automation tables.

Revision ID: 0013_marketing
Revises: 0012_previous
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = '0013_marketing'
down_revision = 'primary_category_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Email event type enum is created implicitly when email_campaigns table is created
    # No need to create it separately
    
    # UserBrowsingHistory table
    op.create_table(
        'user_browsing_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('shop_id', sa.Integer(), nullable=True),
        sa.Column('viewed_at', sa.DateTime(), nullable=False),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id']),
        sa.ForeignKeyConstraint(['category_id'], ['category.id']),
        sa.ForeignKeyConstraint(['shop_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_browsing_history_user_id', 'user_browsing_history', ['user_id'])
    
    # SavedSearch table
    op.create_table(
        'saved_searches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('search_query', sa.String(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('min_price', sa.Float(), nullable=True),
        sa.Column('max_price', sa.Float(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_email_sent', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['category_id'], ['category.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_saved_searches_user_id', 'saved_searches', ['user_id'])
    
    # ListingPerformance table
    op.create_table(
        'listing_performance',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('views', sa.Integer(), nullable=False),
        sa.Column('saves', sa.Integer(), nullable=False),
        sa.Column('chats', sa.Integer(), nullable=False),
        sa.Column('phone_clicks', sa.Integer(), nullable=False),
        sa.Column('week_starting', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_listing_performance_listing_id', 'listing_performance', ['listing_id'])
    
    # EmailCampaign table
    op.create_table(
        'email_campaigns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.Enum('signup', 'shop_created', 'listing_approved', 'listing_rejected', 'listing_views_milestone', 'listing_saved', 'price_dropped', 'abandoned_listing', 'inactive_seller', 'buyer_interested', 'saved_search_match', 'message_received', 'offer_accepted', 'listing_expiring_soon', 'verification_campaign', 'weekly_digest', 'birthday', 'seasonal_campaign', 'reengagement', name='email_event_type'), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('template_name', sa.String(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('clicked_at', sa.DateTime(), nullable=True),
        sa.Column('clicked_link', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('shop_id', sa.Integer(), nullable=True),
        sa.Column('related_user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id']),
        sa.ForeignKeyConstraint(['shop_id'], ['user.id']),
        sa.ForeignKeyConstraint(['related_user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_email_campaigns_user_id', 'email_campaigns', ['user_id'])
    
    # EmailPreference table
    op.create_table(
        'email_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('new_messages', sa.Boolean(), nullable=False),
        sa.Column('listing_updates', sa.Boolean(), nullable=False),
        sa.Column('price_drops', sa.Boolean(), nullable=False),
        sa.Column('saved_search_matches', sa.Boolean(), nullable=False),
        sa.Column('marketplace_digest', sa.Boolean(), nullable=False),
        sa.Column('promotional_emails', sa.Boolean(), nullable=False),
        sa.Column('seller_tips', sa.Boolean(), nullable=False),
        sa.Column('verification_campaigns', sa.Boolean(), nullable=False),
        sa.Column('seasonal_campaigns', sa.Boolean(), nullable=False),
        sa.Column('digest_frequency', sa.String(), nullable=False),
        sa.Column('quiet_hours_start', sa.String(), nullable=True),
        sa.Column('quiet_hours_end', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    
    # UserLifecycleStage table
    op.create_table(
        'user_lifecycle_stage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('stage', sa.String(), nullable=False),
        sa.Column('days_since_signup', sa.Integer(), nullable=False),
        sa.Column('listings_count', sa.Integer(), nullable=False),
        sa.Column('purchases_count', sa.Integer(), nullable=False),
        sa.Column('last_activity', sa.DateTime(), nullable=True),
        sa.Column('reengagement_email_sent', sa.Boolean(), nullable=False),
        sa.Column('reengagement_email_date', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )


def downgrade() -> None:
    op.drop_table('user_lifecycle_stage')
    op.drop_table('email_preferences')
    op.drop_table('email_campaigns')
    op.drop_table('listing_performance')
    op.drop_table('saved_searches')
    op.drop_table('user_browsing_history')
    op.execute('DROP TYPE email_event_type')
