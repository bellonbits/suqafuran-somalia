"""Stub migration for conversation_001

Revision ID: conversation_001
Revises: merge_005
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'conversation_001'
down_revision = 'merge_005'
branch_labels = ('conversation',)
depends_on = None


def upgrade() -> None:
    # Stub - conversation table already exists in production
    pass


def downgrade() -> None:
    pass
