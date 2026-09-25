"""default template

Revision ID: 41faba4aa970
Revises: 0013_marketing, 002_advertising_system, conversation_001, merge_006
Create Date: 2026-07-29 20:07:19.573495

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '41faba4aa970'
down_revision = ('0013_marketing', '002_advertising_system', 'conversation_001', 'merge_006')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
