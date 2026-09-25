"""Create sales_report table

Revision ID: sales_report_001
Revises:
Create Date: 2026-07-22 01:01:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'sales_report_001'
down_revision = 'seller_settings_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sales_report',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('report_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('last_generated', sa.DateTime(), nullable=True),
        sa.Column('report_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['seller_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sales_report_seller_id', 'sales_report', ['seller_id'])


def downgrade() -> None:
    op.drop_index('ix_sales_report_seller_id', table_name='sales_report')
    op.drop_table('sales_report')
