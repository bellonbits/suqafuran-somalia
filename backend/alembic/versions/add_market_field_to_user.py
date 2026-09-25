"""Add market field to user for shop location tracking.

Revision ID: market_001
Revises: 799b15fdf310
Create Date: 2026-07-17 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'market_001'
down_revision = '799b15fdf310'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add market column to user table (note: table name is 'user' singular, not 'users')
    op.add_column('user', sa.Column('market', sa.String(), nullable=True))
    # Create index on market for faster filtering
    op.create_index(op.f('ix_user_market'), 'user', ['market'], unique=False)


def downgrade() -> None:
    # Remove index
    op.drop_index(op.f('ix_user_market'), table_name='user')
    # Remove column
    op.drop_column('user', 'market')
