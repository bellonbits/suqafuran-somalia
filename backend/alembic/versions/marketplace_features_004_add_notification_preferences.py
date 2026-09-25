"""Add NotificationPreferences model for user control

Revision ID: marketplace_004
Revises: marketplace_003
Create Date: 2026-07-24 10:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'marketplace_004'
down_revision = 'marketplace_003'
branch_labels = ('marketplace',)
depends_on = None


def upgrade() -> None:
    # Create notification_preferences table
    op.create_table(
        'notificationpreferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email_messages', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_offers', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_price_drops', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_search_matches', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_order_updates', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_listings', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )


def downgrade() -> None:
    op.drop_table('notificationpreferences')
