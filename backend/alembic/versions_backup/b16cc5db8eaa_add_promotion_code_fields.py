"""default template

Revision ID: b16cc5db8eaa
Revises: a30551a21ff0
Create Date: 2026-02-15 02:51:23.772077

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'b16cc5db8eaa'
down_revision = 'a30551a21ff0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add promotion_code column (unique, indexed)
    op.add_column('promotion', sa.Column('promotion_code', sa.String(), nullable=True))
    op.create_index(op.f('ix_promotion_promotion_code'), 'promotion', ['promotion_code'], unique=False)
    op.create_unique_constraint('uq_promotion_promotion_code', 'promotion', ['promotion_code'])
    
    # Add approved_by column (foreign key to user.id)
    op.add_column('promotion', sa.Column('approved_by', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_promotion_approved_by_user', 'promotion', 'user', ['approved_by'], ['id'])
    
    # Add approved_at column
    op.add_column('promotion', sa.Column('approved_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove columns in reverse order
    op.drop_column('promotion', 'approved_at')
    op.drop_constraint('fk_promotion_approved_by_user', 'promotion', type_='foreignkey')
    op.drop_column('promotion', 'approved_by')
    op.drop_constraint('uq_promotion_promotion_code', 'promotion', type_='unique')
    op.drop_index(op.f('ix_promotion_promotion_code'), table_name='promotion')
    op.drop_column('promotion', 'promotion_code')
