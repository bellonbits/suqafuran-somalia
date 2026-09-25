"""Add review table

Revision ID: add_review_001
Revises: monitoring_001, analytics_001
Create Date: 2026-07-21 06:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_review_001'
down_revision = ('monitoring_001', 'analytics_001')
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'review',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('customer_name', sa.String(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.String(), nullable=False),
        sa.Column('response', sa.String(), nullable=True),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['seller_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_review_product_id'), 'review', ['product_id'], unique=False)
    op.create_index(op.f('ix_review_seller_id'), 'review', ['seller_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_review_seller_id'), table_name='review')
    op.drop_index(op.f('ix_review_product_id'), table_name='review')
    op.drop_table('review')
