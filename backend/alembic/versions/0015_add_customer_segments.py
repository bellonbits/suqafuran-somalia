"""Add customer segmentation table.

Revision ID: 0015_add_customer_segments
Revises: 0014_email_templates
Create Date: 2026-07-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
# Must match what's already stamped in the production alembic_version table --
# this file's revision id was previously shortened to '0015_customer_segments'
# (dropping "add_") after it had already been applied, breaking the chain for
# anything that runs against that database.
revision = '0015_add_customer_segments'
down_revision = '0014_email_templates'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create customer_segment table
    op.create_table(
        'customer_segment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('criteria', sa.Text(), nullable=False),  # JSON rules
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('member_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True, foreign_key="user.id"),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_customer_segment_is_active', 'customer_segment', ['is_active'])


def downgrade() -> None:
    op.drop_index('ix_customer_segment_is_active', table_name='customer_segment')
    op.drop_table('customer_segment')
