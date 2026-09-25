"""default template

Revision ID: 799b15fdf310
Revises: 001_moderation_featured, phase2_order_cart, prevent_duplicate_sellers, shop_mgmt_001
Create Date: 2026-07-15 20:29:51.858304

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '799b15fdf310'
down_revision = ('001_moderation_featured', 'phase2_order_cart', 'prevent_duplicate_sellers', 'shop_mgmt_001')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
