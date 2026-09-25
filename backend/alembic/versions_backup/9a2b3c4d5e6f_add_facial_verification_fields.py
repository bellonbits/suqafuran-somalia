"""add facial verification fields

Revision ID: 9a2b3c4d5e6f
Revises: 8f1e2d3c4b5a
Create Date: 2026-02-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '9a2b3c4d5e6f'
down_revision = '8f1e2d3c4b5a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('verificationrequest', sa.Column('selfie_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('verificationrequest', sa.Column('facial_match_score', sa.Float(), nullable=True))
    op.add_column('verificationrequest', sa.Column('auto_verification_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    op.drop_column('verificationrequest', 'auto_verification_status')
    op.drop_column('verificationrequest', 'facial_match_score')
    op.drop_column('verificationrequest', 'selfie_url')
