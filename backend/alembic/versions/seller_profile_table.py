"""Create seller profile table

Revision ID: seller_profile_table
Revises: listing_approval_001
Create Date: 2026-07-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'seller_profile_table'
down_revision = 'listing_approval_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(text('''
        CREATE TABLE IF NOT EXISTS sellerprofile (
            id SERIAL PRIMARY KEY,
            seller_id INTEGER NOT NULL UNIQUE,
            shop_name VARCHAR,
            description TEXT,
            phone VARCHAR,
            email VARCHAR,
            location VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (seller_id) REFERENCES "user"(id) ON DELETE CASCADE
        )
    '''))


def downgrade() -> None:
    op.execute(text('DROP TABLE IF EXISTS sellerprofile'))
