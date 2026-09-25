"""add subsubcategory table

Revision ID: 4c5d6e7f8a9b
Revises: 2afc0c522f7b
Create Date: 2026-03-09 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '4c5d6e7f8a9b'
down_revision = 'prod_indexes_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'subsubcategory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('subcategory_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['subcategory_id'], ['subcategory.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_subsubcategory_name', 'subsubcategory', ['name'])
    op.create_index('ix_subsubcategory_slug', 'subsubcategory', ['slug'])

    op.add_column('listing', sa.Column('subsubcategory_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'listing', 'subsubcategory', ['subsubcategory_id'], ['id'])


def downgrade():
    op.drop_constraint(None, 'listing', type_='foreignkey')
    op.drop_column('listing', 'subsubcategory_id')
    op.drop_index('ix_subsubcategory_slug', table_name='subsubcategory')
    op.drop_index('ix_subsubcategory_name', table_name='subsubcategory')
    op.drop_table('subsubcategory')
