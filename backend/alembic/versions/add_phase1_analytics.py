"""Add Phase 1 analytics models: Search, Click, Conversion funnel.

Revision ID: add_phase1_analytics_001
Revises: add_analytics_views_001
Create Date: 2026-07-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_phase1_analytics_001'
down_revision = 'add_analytics_views_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old click_event table from analytics_001 (pixel tracking, different schema)
    # Use raw SQL to handle table that may exist with different schema
    from sqlalchemy import text
    bind = op.get_context().bind

    # Check if click_event exists and drop it
    inspector = sa.inspect(bind)
    if 'click_event' in inspector.get_table_names():
        op.drop_table('click_event')

    # SearchEvent table
    op.create_table(
        'search_event',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('query', sa.String(), nullable=False),
        sa.Column('result_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('device_type', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('category_filter', sa.String(), nullable=True),
        sa.Column('location_filter', sa.String(), nullable=True),
        sa.Column('searched_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_search_event_query', 'query'),
        sa.Index('ix_search_event_user_id', 'user_id'),
        sa.Index('ix_search_event_searched_at', 'searched_at'),
    )

    # ClickEvent table (user actions: chat, call, favorite)
    op.create_table(
        'click_event',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('shop_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('device_type', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('clicked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['shop_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_click_event_event_type', 'event_type'),
        sa.Index('ix_click_event_listing_id', 'listing_id'),
        sa.Index('ix_click_event_user_id', 'user_id'),
        sa.Index('ix_click_event_clicked_at', 'clicked_at'),
    )

    # ConversionFunnelEvent table
    op.create_table(
        'conversion_funnel_event',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('stage', sa.String(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('shop_id', sa.Integer(), nullable=True),
        sa.Column('device_type', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_conversion_funnel_event_stage', 'stage'),
        sa.Index('ix_conversion_funnel_event_user_id', 'user_id'),
        sa.Index('ix_conversion_funnel_event_created_at', 'created_at'),
    )


def downgrade() -> None:
    op.drop_table('conversion_funnel_event')
    op.drop_table('click_event')
    op.drop_table('search_event')
