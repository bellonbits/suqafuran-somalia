"""add marketing codes table and user referral fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    inspector = Inspector.from_engine(op.get_bind())
    existing_tables = inspector.get_table_names()

    # marketing_codes table
    if 'marketing_codes' not in existing_tables:
        op.create_table(
            'marketing_codes',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('code', sa.String(50), nullable=False, unique=True, index=True),
            sa.Column('description', sa.String(), nullable=False, server_default=''),
            sa.Column('created_by', sa.String(), nullable=False, server_default=''),
            sa.Column('max_uses', sa.Integer(), nullable=True),
            sa.Column('uses_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('ads_posted_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # user referral columns
    user_columns = {c['name'] for c in inspector.get_columns('user')}
    if 'referral_code' not in user_columns:
        op.add_column('user', sa.Column('referral_code', sa.String(), nullable=True, index=True))
    if 'referral_listing_counted' not in user_columns:
        op.add_column('user', sa.Column('referral_listing_counted', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('user', 'referral_listing_counted')
    op.drop_column('user', 'referral_code')
    op.drop_table('marketing_codes')
