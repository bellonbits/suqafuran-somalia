"""Add SavedSearch model for search alerts

Revision ID: marketplace_003
Revises: marketplace_002
Create Date: 2026-07-24 10:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'marketplace_003'
down_revision = 'marketplace_002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create saved_search table
    op.create_table(
        'savedsearch',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('query', sa.String(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('min_price', sa.Float(), nullable=True),
        sa.Column('max_price', sa.Float(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_matched_at', sa.DateTime(), nullable=True),
        sa.Column('match_count', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_savedsearch_user_id'), 'savedsearch', ['user_id'], unique=False)
    op.create_index(op.f('ix_savedsearch_is_active'), 'savedsearch', ['is_active'], unique=False)
    op.create_index(op.f('ix_savedsearch_created_at'), 'savedsearch', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_savedsearch_created_at'), table_name='savedsearch')
    op.drop_index(op.f('ix_savedsearch_is_active'), table_name='savedsearch')
    op.drop_index(op.f('ix_savedsearch_user_id'), table_name='savedsearch')
    op.drop_table('savedsearch')
