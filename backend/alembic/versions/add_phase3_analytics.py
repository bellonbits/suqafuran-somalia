"""Add Phase 3 analytics: Device metrics and Admin alerts.

Revision ID: add_phase3_analytics_001
Revises: add_phase2_analytics_001
Create Date: 2026-07-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_phase3_analytics_001'
down_revision = 'add_phase2_analytics_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # DeviceMetric table
    op.create_table(
        'device_metric',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('device_type', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_device_metric_device_type', 'device_type'),
        sa.Index('ix_device_metric_event_type', 'event_type'),
        sa.Index('ix_device_metric_date', 'date'),
    )

    # AdminAlert table
    op.create_table(
        'admin_alert',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('alert_type', sa.String(), nullable=False),
        sa.Column('metric', sa.String(), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('comparison', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('notify_admin', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('notify_seller', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_admin_alert_alert_type', 'alert_type'),
    )

    # AlertEvent table
    op.create_table(
        'alert_event',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('alert_id', sa.String(), nullable=False),
        sa.Column('alert_type', sa.String(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='triggered'),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['alert_id'], ['admin_alert.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_alert_event_alert_id', 'alert_id'),
        sa.Index('ix_alert_event_alert_type', 'alert_type'),
        sa.Index('ix_alert_event_created_at', 'created_at'),
    )


def downgrade() -> None:
    op.drop_table('alert_event')
    op.drop_table('admin_alert')
    op.drop_table('device_metric')
