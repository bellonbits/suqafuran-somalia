"""Add attributes_schema to subsubcategory

Revision ID: 20260722_add_attrs_schema
Revises: category_attributes_001_create_tables
Create Date: 2026-07-22 11:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260722_add_attrs_schema'
down_revision = 'merge_heads_004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('subsubcategory', sa.Column('attributes_schema', postgresql.JSON(), nullable=True))


def downgrade():
    op.drop_column('subsubcategory', 'attributes_schema')
