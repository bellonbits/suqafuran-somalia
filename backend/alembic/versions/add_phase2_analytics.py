"""Add Phase 2 analytics: Geographic and User Cohort tracking.

Revision ID: add_phase2_analytics_001
Revises: add_phase1_analytics_001
Create Date: 2026-07-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_phase2_analytics_001'
down_revision = 'add_phase1_analytics_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # GeographicEvent table
    op.create_table(
        'geographic_event',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('shop_id', sa.Integer(), nullable=True),
        sa.Column('device_type', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_geographic_event_city', 'city'),
        sa.Index('ix_geographic_event_country', 'country'),
        sa.Index('ix_geographic_event_user_id', 'user_id'),
        sa.Index('ix_geographic_event_created_at', 'created_at'),
    )

    # UserCohort table
    op.create_table(
        'user_cohort',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('first_visit_at', sa.DateTime(), nullable=False),
        sa.Column('last_visit_at', sa.DateTime(), nullable=False),
        sa.Column('visit_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_seller', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('total_searches', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_clicks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_chats', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_user_cohort_user_id', 'user_id'),
        sa.Index('ix_user_cohort_first_visit_at', 'first_visit_at'),
    )


def downgrade() -> None:
    op.drop_table('user_cohort')
    op.drop_table('geographic_event')
