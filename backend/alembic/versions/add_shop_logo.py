"""Add shop logo field to user table

Revision ID: add_shop_logo
Revises: seller_profile_table
Create Date: 2026-07-25 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_shop_logo'
down_revision = 'seller_profile_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('logo_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'logo_url')
