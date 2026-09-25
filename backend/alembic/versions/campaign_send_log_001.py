"""Create campaign_send_log table

Backs the promotional campaign rotation engine (app/services/rotation_engine.py,
app/services/campaign_catalog.py): one row per campaign email actually sent
to a user, used to enforce per-campaign cooldowns and weekly frequency caps.

Revision ID: campaign_send_log_001
Revises: listing_report_001
Create Date: 2026-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'campaign_send_log_001'
down_revision = 'listing_report_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'campaign_send_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('campaign_type', sa.String(), nullable=False),
        sa.Column('subject_variant', sa.String(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('listing_ids', sa.String(), nullable=True),
        sa.Column('shop_ids', sa.String(), nullable=True),
        sa.Column('template_event_type', sa.String(), nullable=True),
        sa.Column('email_log_id', sa.Integer(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ),
        sa.ForeignKeyConstraint(['email_log_id'], ['emaillog.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_campaign_send_log_user_id', 'campaign_send_log', ['user_id'])
    op.create_index('ix_campaign_send_log_campaign_type', 'campaign_send_log', ['campaign_type'])
    op.create_index('ix_campaign_send_log_category_id', 'campaign_send_log', ['category_id'])
    op.create_index('ix_campaign_send_log_sent_at', 'campaign_send_log', ['sent_at'])
    op.create_index(
        'ix_campaign_send_log_user_type_sent',
        'campaign_send_log', ['user_id', 'campaign_type', 'sent_at']
    )


def downgrade() -> None:
    op.drop_index('ix_campaign_send_log_user_type_sent', table_name='campaign_send_log')
    op.drop_index('ix_campaign_send_log_sent_at', table_name='campaign_send_log')
    op.drop_index('ix_campaign_send_log_category_id', table_name='campaign_send_log')
    op.drop_index('ix_campaign_send_log_campaign_type', table_name='campaign_send_log')
    op.drop_index('ix_campaign_send_log_user_id', table_name='campaign_send_log')
    op.drop_table('campaign_send_log')
