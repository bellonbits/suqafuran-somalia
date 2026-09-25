"""Add primary_category_id to users table for shop categorization

Revision ID: primary_category_001
Revises: seller_profile_001
Create Date: 2026-07-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'primary_category_001'
down_revision = 'seller_profile_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add primary_category_id column to user table
    op.add_column('user', sa.Column('primary_category_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_user_primary_category', 'user', 'category', ['primary_category_id'], ['id'])
    op.create_index('ix_user_primary_category_id', 'user', ['primary_category_id'])


def downgrade() -> None:
    # Remove primary_category_id column from user table
    op.drop_index('ix_user_primary_category_id', table_name='user')
    op.drop_constraint('fk_user_primary_category', 'user', type_='foreignkey')
    op.drop_column('user', 'primary_category_id')
