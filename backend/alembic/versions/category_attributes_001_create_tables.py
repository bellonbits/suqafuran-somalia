"""Create category attributes and subcategory tables

Revision ID: category_attributes_001
Revises: sales_report_001
Create Date: 2026-07-22 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'category_attributes_001'
down_revision = 'sales_report_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create subcategory table
    op.create_table(
        'subcategory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('name_en', sa.String(), nullable=False),
        sa.Column('name_so', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False, unique=True),
        sa.Column('icon_name', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subcategory_category_id', 'subcategory', ['category_id'])
    op.create_index('ix_subcategory_slug', 'subcategory', ['slug'], unique=True)

    # Create attribute_group table
    op.create_table(
        'attribute_group',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False, unique=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_attribute_group_slug', 'attribute_group', ['slug'], unique=True)

    # Create attribute table
    op.create_table(
        'attribute',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attribute_group_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False, unique=True),
        sa.Column('field_type', sa.String(), nullable=False),
        sa.Column('required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('placeholder', sa.String(), nullable=True),
        sa.Column('validation_regex', sa.String(), nullable=True),
        sa.Column('min_value', sa.Float(), nullable=True),
        sa.Column('max_value', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['attribute_group_id'], ['attribute_group.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_attribute_attribute_group_id', 'attribute', ['attribute_group_id'])
    op.create_index('ix_attribute_slug', 'attribute', ['slug'], unique=True)

    # Create attribute_option table
    op.create_table(
        'attribute_option',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attribute_id', sa.Integer(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['attribute_id'], ['attribute.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_attribute_option_attribute_id', 'attribute_option', ['attribute_id'])

    # Create category_attribute junction table
    op.create_table(
        'category_attribute',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('attribute_id', sa.Integer(), nullable=False),
        sa.Column('required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ),
        sa.ForeignKeyConstraint(['attribute_id'], ['attribute.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_category_attribute_category_id', 'category_attribute', ['category_id'])
    op.create_index('ix_category_attribute_attribute_id', 'category_attribute', ['attribute_id'])

    # Create subcategory_attribute junction table
    op.create_table(
        'subcategory_attribute',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subcategory_id', sa.Integer(), nullable=False),
        sa.Column('attribute_id', sa.Integer(), nullable=False),
        sa.Column('required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['subcategory_id'], ['subcategory.id'], ),
        sa.ForeignKeyConstraint(['attribute_id'], ['attribute.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subcategory_attribute_subcategory_id', 'subcategory_attribute', ['subcategory_id'])
    op.create_index('ix_subcategory_attribute_attribute_id', 'subcategory_attribute', ['attribute_id'])

    # Create listing_attribute table
    op.create_table(
        'listing_attribute',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('attribute_id', sa.Integer(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['attribute_id'], ['attribute.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_listing_attribute_listing_id', 'listing_attribute', ['listing_id'])
    op.create_index('ix_listing_attribute_attribute_id', 'listing_attribute', ['attribute_id'])


def downgrade() -> None:
    op.drop_index('ix_listing_attribute_attribute_id', table_name='listing_attribute')
    op.drop_index('ix_listing_attribute_listing_id', table_name='listing_attribute')
    op.drop_table('listing_attribute')

    op.drop_index('ix_subcategory_attribute_attribute_id', table_name='subcategory_attribute')
    op.drop_index('ix_subcategory_attribute_subcategory_id', table_name='subcategory_attribute')
    op.drop_table('subcategory_attribute')

    op.drop_index('ix_category_attribute_attribute_id', table_name='category_attribute')
    op.drop_index('ix_category_attribute_category_id', table_name='category_attribute')
    op.drop_table('category_attribute')

    op.drop_index('ix_attribute_option_attribute_id', table_name='attribute_option')
    op.drop_table('attribute_option')

    op.drop_index('ix_attribute_slug', table_name='attribute')
    op.drop_index('ix_attribute_attribute_group_id', table_name='attribute')
    op.drop_table('attribute')

    op.drop_index('ix_attribute_group_slug', table_name='attribute_group')
    op.drop_table('attribute_group')

    op.drop_index('ix_subcategory_slug', table_name='subcategory')
    op.drop_index('ix_subcategory_category_id', table_name='subcategory')
    op.drop_table('subcategory')
