"""add is_negotiable to listing and bulk_price fields

Revision ID: a1b2c3d4e5f6
Revises: f2e1d0c9b8a7
Create Date: 2026-05-02 15:54:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '8e906b4a5f98'
branch_labels = None
depends_on = None


def get_columns(table_name):
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    return [c['name'] for c in inspector.get_columns(table_name)]


def upgrade():
    cols = get_columns('listing')

    # Add is_negotiable column (boolean, defaults to False for existing rows)
    if 'is_negotiable' not in cols:
        op.add_column(
            'listing',
            sa.Column('is_negotiable', sa.Boolean(), nullable=False, server_default='false')
        )


def downgrade():
    cols = get_columns('listing')
    if 'is_negotiable' in cols:
        op.drop_column('listing', 'is_negotiable')
