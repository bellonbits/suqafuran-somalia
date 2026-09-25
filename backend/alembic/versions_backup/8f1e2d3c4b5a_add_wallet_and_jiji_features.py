"""add wallet and jiji features

Revision ID: 8f1e2d3c4b5a
Revises: 7485dfc54bf2
Create Date: 2026-02-10 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '8f1e2d3c4b5a'
down_revision = '7485dfc54bf2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update User
    op.add_column('user', sa.Column('avatar_url', sa.String(), nullable=True))
    op.add_column('user', sa.Column('response_time', sa.String(), nullable=True))
    
    # 2. Update Category
    op.add_column('category', sa.Column('attributes_schema', sa.JSON(), nullable=True))
    
    # 3. Update Listing
    op.add_column('listing', sa.Column('boost_level', sa.Integer(), nullable=True))
    op.add_column('listing', sa.Column('boost_expires_at', sa.DateTime(), nullable=True))
    op.add_column('listing', sa.Column('attributes', sa.JSON(), nullable=True))
    op.add_column('listing', sa.Column('currency', sa.String(), nullable=True, server_default='USD'))
    
    # 4. Create Wallet
    op.create_table('wallet',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('balance', sa.Float(), nullable=False),
    sa.Column('currency', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    
    # 5. Create Transaction
    op.create_table('transaction',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('wallet_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('type', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('reference', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['wallet_id'], ['wallet.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transaction_reference'), 'transaction', ['reference'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_transaction_reference'), table_name='transaction')
    op.drop_table('transaction')
    op.drop_table('wallet')
    op.drop_column('listing', 'currency')
    op.drop_column('listing', 'attributes')
    op.drop_column('listing', 'boost_expires_at')
    op.drop_column('listing', 'boost_level')
    op.drop_column('category', 'attributes_schema')
    op.drop_column('user', 'response_time')
    op.drop_column('user', 'avatar_url')
