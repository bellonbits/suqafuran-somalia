"""Create seller_settings table

Revision ID: seller_settings_001
Revises:
Create Date: 2026-07-22 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'seller_settings_001'
down_revision = 'bulk_products_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'seller_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('push_notifications', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_notifications', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('order_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('low_stock_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['seller_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('seller_id', name='uq_seller_settings_seller_id')
    )
    op.create_index('ix_seller_settings_seller_id', 'seller_settings', ['seller_id'])


def downgrade() -> None:
    op.drop_index('ix_seller_settings_seller_id', table_name='seller_settings')
    op.drop_table('seller_settings')
