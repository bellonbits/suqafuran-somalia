"""Add waiting_for_payment to promotionstatus enum

Revision ID: 2a3b4c5d6e7f
Revises: 1166429523d3
Create Date: 2026-02-18 23:04:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2a3b4c5d6e7f'
down_revision = '1166429523d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new enum values to the existing promotionstatus type in PostgreSQL.
    # PostgreSQL requires ALTER TYPE ... ADD VALUE for each new label.
    # We use IF NOT EXISTS to make this idempotent.
    op.execute("ALTER TYPE promotionstatus ADD VALUE IF NOT EXISTS 'waiting_for_payment'")
    op.execute("ALTER TYPE promotionstatus ADD VALUE IF NOT EXISTS 'pending'")
    op.execute("ALTER TYPE promotionstatus ADD VALUE IF NOT EXISTS 'paid'")
    op.execute("ALTER TYPE promotionstatus ADD VALUE IF NOT EXISTS 'rejected'")
    op.execute("ALTER TYPE promotionstatus ADD VALUE IF NOT EXISTS 'expired'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # A full type recreation would be needed, which is risky.
    pass
