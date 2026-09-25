"""Add buyer/seller confirmation fields to deal

Revision ID: 20260825_deal_confirm
Revises: 20260825_compare_at_price
Create Date: 2026-08-25 00:00:00.000000

The `deal` table was created (59ee1dc2a297) without buyer_confirmed/
seller_confirmed even though the Deal model has always declared them --
this was never triggered because nothing wrote/read Deal until now.

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260825_deal_confirm'
down_revision = '20260825_compare_at_price'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('deal', sa.Column('buyer_confirmed', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('deal', sa.Column('seller_confirmed', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('deal', sa.Column('buyer_confirmed_at', sa.DateTime(), nullable=True))
    op.add_column('deal', sa.Column('seller_confirmed_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('deal', 'seller_confirmed_at')
    op.drop_column('deal', 'buyer_confirmed_at')
    op.drop_column('deal', 'seller_confirmed')
    op.drop_column('deal', 'buyer_confirmed')
