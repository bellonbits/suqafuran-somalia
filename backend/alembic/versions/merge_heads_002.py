"""merge heads for verified levels and support tickets

Revision ID: merge_heads_002
Revises: f0b1c2d3e4f5, 9f8e7d6c5b4b
Create Date: 2026-05-10 22:26:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_002'
down_revision = ('f0b1c2d3e4f5', '9f8e7d6c5b4b')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
