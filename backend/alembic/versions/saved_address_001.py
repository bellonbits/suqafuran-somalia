"""add saved_address table

Revision ID: saved_address_001
Revises: merge_heads_003
Create Date: 2026-06-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'saved_address_001'
down_revision = 'merge_heads_003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'savedaddress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('label', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('formatted_address', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_savedaddress_user_id'), 'savedaddress', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_savedaddress_user_id'), table_name='savedaddress')
    op.drop_table('savedaddress')
