"""merge heads for forensic and admin fields

Revision ID: merge_heads_001
Revises: c3d4e5f6a7b8, f0a1b2c3d4e5
Create Date: 2026-05-09 13:42:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_001'
down_revision = ('c3d4e5f6a7b8', 'f0a1b2c3d4e5')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
