"""Add id_number to verificationrequest

Revision ID: c8b2d3e4f5g6
Revises: b7a1c2d3e4f5
Create Date: 2026-05-08 20:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision = 'c8b2d3e4f5g6'
down_revision = 'b7a1c2d3e4f5'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('verificationrequest', sa.Column('id_number', sa.String(), nullable=True))

def downgrade():
    op.drop_column('verificationrequest', 'id_number')
