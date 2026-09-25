"""Create monitoring tables for Phase 5 Alert Rules Engine.

Revision ID: monitoring_001
Revises: market_002
Create Date: 2026-07-18 07:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'monitoring_001'
down_revision = 'market_002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create alert_rules table
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.String(512), nullable=True),
        sa.Column('metric', sa.String(255), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('comparison_operator', sa.String(10), nullable=False),
        sa.Column('evaluation_window_minutes', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('aggregation_function', sa.String(50), nullable=False, server_default='avg'),
        sa.Column('metric_filter', sa.JSON(), nullable=True),
        sa.Column('notification_channel', sa.String(255), nullable=True),
        sa.Column('notification_target', sa.String(255), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true', index=True),
        sa.Column('severity', sa.String(50), nullable=False, server_default='warning'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create alert_history table
    op.create_table(
        'alert_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=False, index=True),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('fired_at', sa.DateTime(), nullable=False, index=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('message', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['rule_id'], ['alert_rules.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create notification_log table
    op.create_table(
        'notification_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.String(255), nullable=False, index=True),
        sa.Column('correlation_id', sa.String(255), nullable=False, index=True),
        sa.Column('trace_id', sa.String(255), nullable=True),
        sa.Column('event_type', sa.String(255), nullable=False),
        sa.Column('channel', sa.String(50), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True, index=True),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('error_message', sa.String(512), nullable=True),
        sa.Column('dispatched_at', sa.DateTime(), nullable=False),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('notification_log')
    op.drop_table('alert_history')
    op.drop_table('alert_rules')
