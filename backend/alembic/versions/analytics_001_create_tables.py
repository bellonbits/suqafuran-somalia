"""Create analytics tables for Phase 4.

Revision ID: analytics_001
Revises: monitoring_001
Create Date: 2026-07-18 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'analytics_001'
down_revision = 'monitoring_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_session',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_token', sa.String(255), nullable=False, unique=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(512), nullable=True),
        sa.Column('device_type', sa.String(50), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('last_activity_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('current_page', sa.String(512), nullable=True),
        sa.Column('page_history', sa.JSON(), nullable=True),
        sa.Column('total_clicks', sa.Integer(), server_default='0'),
        sa.Column('total_interactions', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true', index=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'user_activity',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('action_type', sa.String(100), nullable=False),
        sa.Column('action_category', sa.String(100), nullable=False),
        sa.Column('resource_id', sa.String(255), nullable=True),
        sa.Column('resource_type', sa.String(100), nullable=True),
        sa.Column('page_url', sa.String(512), nullable=True),
        sa.Column('referrer', sa.String(512), nullable=True),
        sa.Column('search_query', sa.String(512), nullable=True),
        sa.Column('event_metadata', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, index=True, server_default=sa.func.now()),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'conversion_funnel',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('step', sa.String(50), nullable=False),
        sa.Column('completed', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, index=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'click_event',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('page_url', sa.String(512), nullable=True),
        sa.Column('element_id', sa.String(255), nullable=True),
        sa.Column('element_class', sa.String(512), nullable=True),
        sa.Column('element_type', sa.String(100), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('click_event')
    op.drop_table('conversion_funnel')
    op.drop_table('user_activity')
    op.drop_table('user_session')
