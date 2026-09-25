"""add report admin fields

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def column_exists(table, column):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    return any(c['name'] == column for c in inspector.get_columns(table))


def upgrade():
    for col, type_ in [
        ('reported_user_id', sa.Integer()),
        ('admin_note', sa.String()),
        ('admin_action', sa.String()),
        ('resolved_at', sa.DateTime()),
    ]:
        if not column_exists('report', col):
            op.add_column('report', sa.Column(col, type_, nullable=True))


def downgrade():
    for col in ['reported_user_id', 'admin_note', 'admin_action', 'resolved_at']:
        op.drop_column('report', col)
