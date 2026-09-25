"""add otp_log table

Revision ID: otp_log_001
Revises: merge_heads_002
Create Date: 2026-06-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'otp_log_001'
down_revision = 'merge_heads_002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'otp_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('identifier', sa.String(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('idempotency_key', sa.String(), nullable=True),
        sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('idempotency_key'),
    )
    op.create_index('ix_otp_log_identifier', 'otp_log', ['identifier'])
    op.create_index('ix_otp_log_channel', 'otp_log', ['channel'])
    op.create_index('ix_otp_log_event_type', 'otp_log', ['event_type'])
    op.create_index('ix_otp_log_created_at', 'otp_log', ['created_at'])
    op.create_index('ix_otp_log_idempotency_key', 'otp_log', ['idempotency_key'])
    op.create_index('ix_otp_log_identifier_created', 'otp_log', ['identifier', 'created_at'])


def downgrade():
    op.drop_index('ix_otp_log_identifier_created', table_name='otp_log')
    op.drop_index('ix_otp_log_idempotency_key', table_name='otp_log')
    op.drop_index('ix_otp_log_created_at', table_name='otp_log')
    op.drop_index('ix_otp_log_event_type', table_name='otp_log')
    op.drop_index('ix_otp_log_channel', table_name='otp_log')
    op.drop_index('ix_otp_log_identifier', table_name='otp_log')
    op.drop_table('otp_log')
