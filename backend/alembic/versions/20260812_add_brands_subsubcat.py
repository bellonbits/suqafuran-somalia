"""Add brands to subsubcategory

Revision ID: 20260812_add_brands
Revises: merge_heads_007
Create Date: 2026-08-12 00:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260812_add_brands'
down_revision = 'merge_heads_007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('subsubcategory', sa.Column('brands', postgresql.JSON(), nullable=True))


def downgrade():
    op.drop_column('subsubcategory', 'brands')
