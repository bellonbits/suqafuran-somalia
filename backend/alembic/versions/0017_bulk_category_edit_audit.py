"""Create product_field_changes table for category-based bulk edit audit trail.

Chained onto 0016_promo_template_fields only, not merged with the other
existing head (41faba4aa970) -- that merge hits a pre-existing overlap in
the migration graph (0013_marketing is reachable from 41faba4aa970 as a
direct merge parent AND separately as an ancestor of 0014/0015/0016), which
predates this change and needs its own dedicated investigation. Both heads
were already independently "current" in the database before this migration
existed, so leaving them unmerged doesn't make anything worse.

Revision ID: 0017_bulk_category_edit_audit
Revises: 0016_promo_template_fields
Create Date: 2026-08-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0017_bulk_category_edit_audit'
down_revision = '0016_promo_template_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'product_field_changes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False, index=True),
        sa.Column('field', sa.String(32), nullable=False),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=False, index=True, server_default=sa.func.now()),
        sa.Column('changed_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['changed_by'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('product_field_changes')
