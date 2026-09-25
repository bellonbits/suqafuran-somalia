"""update userverifiedlevel enum and data

Revision ID: f0b1c2d3e4f5
Revises: merge_heads_001
Create Date: 2026-05-09 13:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f0b1c2d3e4f5'
down_revision = 'merge_heads_001'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add new values to the enum type in Postgres
    # New enum values must be committed before they can be used in the same transaction.
    # We use autocommit_block to ensure they are committed immediately.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userverifiedlevel ADD VALUE IF NOT EXISTS 'tier1'")
        op.execute("ALTER TYPE userverifiedlevel ADD VALUE IF NOT EXISTS 'tier2'")
        op.execute("ALTER TYPE userverifiedlevel ADD VALUE IF NOT EXISTS 'tier3'")

    # 2. Update existing data to use the new values
    op.execute("UPDATE \"user\" SET verified_level = 'tier1' WHERE verified_level = 'phone'")
    op.execute("UPDATE \"user\" SET verified_level = 'tier2' WHERE verified_level = 'id'")


def downgrade():
    # Reverting data is possible, but removing enum values in PG is hard (requires recreating type)
    op.execute("UPDATE \"user\" SET verified_level = 'phone' WHERE verified_level = 'tier1'")
    op.execute("UPDATE \"user\" SET verified_level = 'id' WHERE verified_level = 'tier2'")
