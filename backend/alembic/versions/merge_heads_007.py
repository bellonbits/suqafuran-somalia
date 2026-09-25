"""Merge migration heads

Revision ID: merge_heads_007
Revises: 0017_bulk_category_edit_audit, 41faba4aa970
Create Date: 2026-08-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_007'
down_revision = ('0017_bulk_category_edit_audit', '41faba4aa970')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
