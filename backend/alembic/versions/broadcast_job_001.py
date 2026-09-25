"""Create broadcast_job and broadcast_job_recipient tables

Backs daily-batched admin broadcast campaigns (app/tasks/email_tasks.py's
process_broadcast_jobs_task) so a broadcast to a large user base drips out
under a per-day sending quota instead of firing every recipient at once.

Revision ID: broadcast_job_001
Revises: campaign_send_log_001
Create Date: 2026-08-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'broadcast_job_001'
down_revision = 'campaign_send_log_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'broadcast_job',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('subtitle', sa.String(), nullable=True),
        sa.Column('content_html', sa.String(), nullable=False),
        sa.Column('action_text', sa.String(), nullable=True),
        sa.Column('action_url', sa.String(), nullable=True),
        sa.Column('campaign_id', sa.String(), nullable=True),
        sa.Column('daily_limit', sa.Integer(), nullable=False, server_default='250'),
        sa.Column('status', sa.String(), nullable=False, server_default='in_progress'),
        sa.Column('total_recipients', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_broadcast_job_status', 'broadcast_job', ['status'])

    op.create_table(
        'broadcast_job_recipient',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('failed_reason', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['broadcast_job.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_broadcast_job_recipient_job_id', 'broadcast_job_recipient', ['job_id'])
    op.create_index('ix_broadcast_job_recipient_user_id', 'broadcast_job_recipient', ['user_id'])
    op.create_index('ix_broadcast_job_recipient_status', 'broadcast_job_recipient', ['status'])
    op.create_index('ix_broadcast_job_recipient_sent_at', 'broadcast_job_recipient', ['sent_at'])


def downgrade() -> None:
    op.drop_index('ix_broadcast_job_recipient_sent_at', table_name='broadcast_job_recipient')
    op.drop_index('ix_broadcast_job_recipient_status', table_name='broadcast_job_recipient')
    op.drop_index('ix_broadcast_job_recipient_user_id', table_name='broadcast_job_recipient')
    op.drop_index('ix_broadcast_job_recipient_job_id', table_name='broadcast_job_recipient')
    op.drop_table('broadcast_job_recipient')
    op.drop_index('ix_broadcast_job_status', table_name='broadcast_job')
    op.drop_table('broadcast_job')
