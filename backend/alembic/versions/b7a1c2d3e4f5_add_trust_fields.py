"""Add trust and security fields to user

Revision ID: b7a1c2d3e4f5
Revises: f2e1d0c9b8a7
Create Date: 2026-05-08 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision = 'b7a1c2d3e4f5'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('user', sa.Column('trust_score', sa.Integer(), server_default='0', nullable=False))
    op.add_column('user', sa.Column('trust_level', sqlmodel.sql.sqltypes.AutoString(), server_default='NEW', nullable=False))
    op.add_column('user', sa.Column('is_flagged', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('user', sa.Column('is_suspended', sa.Boolean(), server_default='false', nullable=False))

def downgrade():
    op.drop_column('user', 'is_suspended')
    op.drop_column('user', 'is_flagged')
    op.drop_column('user', 'trust_level')
    op.drop_column('user', 'trust_score')
