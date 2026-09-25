"""bilingual content overhaul

Revision ID: f2e1d0c9b8a7
Revises: 519bc90469b2
Create Date: 2024-04-13 17:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'f2e1d0c9b8a7'
down_revision = '519bc90469b2'
branch_labels = None
depends_on = None

def get_columns(table_name):
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    return [c['name'] for c in inspector.get_columns(table_name)]

def upgrade():
    # --- Category ---
    cols = get_columns('category')
    if 'name' in cols and 'name_en' not in cols:
        op.alter_column('category', 'name', new_column_name='name_en')
    if 'name_so' not in cols:
        op.add_column('category', sa.Column('name_so', sa.String(), nullable=True))
    
    # --- SubCategory ---
    cols = get_columns('subcategory')
    if 'name' in cols and 'name_en' not in cols:
        op.alter_column('subcategory', 'name', new_column_name='name_en')
    if 'name_so' not in cols:
        op.add_column('subcategory', sa.Column('name_so', sa.String(), nullable=True))
    
    # --- SubSubCategory ---
    cols = get_columns('subsubcategory')
    if 'name' in cols and 'name_en' not in cols:
        op.alter_column('subsubcategory', 'name', new_column_name='name_en')
    if 'name_so' not in cols:
        op.add_column('subsubcategory', sa.Column('name_so', sa.String(), nullable=True))
    
    # --- Listing ---
    cols = get_columns('listing')
    if 'title' in cols and 'title_en' not in cols:
        op.alter_column('listing', 'title', new_column_name='title_en')
    if 'title_so' not in cols:
        op.add_column('listing', sa.Column('title_so', sa.String(), nullable=True))
    
    if 'description' in cols and 'description_en' not in cols:
        op.alter_column('listing', 'description', new_column_name='description_en')
    if 'description_so' not in cols:
        op.add_column('listing', sa.Column('description_so', sa.String(), nullable=True))
    
    if 'lang_available' not in cols:
        op.add_column('listing', sa.Column('lang_available', sa.String(), nullable=False, server_default='en'))
    
    # --- PromotionPlan ---
    cols = get_columns('promotionplan')
    if 'name' in cols and 'name_en' not in cols:
        op.alter_column('promotionplan', 'name', new_column_name='name_en')
    if 'name_so' not in cols:
        op.add_column('promotionplan', sa.Column('name_so', sa.String(), nullable=True))
    
    if 'description' in cols and 'description_en' not in cols:
        op.alter_column('promotionplan', 'description', new_column_name='description_en')
    if 'description_so' not in cols:
        op.add_column('promotionplan', sa.Column('description_so', sa.String(), nullable=True))

def downgrade():
    # --- PromotionPlan ---
    cols = get_columns('promotionplan')
    if 'description_en' in cols:
        op.alter_column('promotionplan', 'description_en', new_column_name='description')
    if 'description_so' in cols:
        op.drop_column('promotionplan', 'description_so')
    if 'name_en' in cols:
        op.alter_column('promotionplan', 'name_en', new_column_name='name')
    if 'name_so' in cols:
        op.drop_column('promotionplan', 'name_so')
    
    # --- Listing ---
    cols = get_columns('listing')
    if 'lang_available' in cols:
        op.drop_column('listing', 'lang_available')
    if 'description_so' in cols:
        op.drop_column('listing', 'description_so')
    if 'description_en' in cols:
        op.alter_column('listing', 'description_en', new_column_name='description')
    if 'title_so' in cols:
        op.drop_column('listing', 'title_so')
    if 'title_en' in cols:
        op.alter_column('listing', 'title_en', new_column_name='title')
    
    # --- SubSubCategory ---
    cols = get_columns('subsubcategory')
    if 'name_so' in cols:
        op.drop_column('subsubcategory', 'name_so')
    if 'name_en' in cols:
        op.alter_column('subsubcategory', 'name_en', new_column_name='name')
    
    # --- SubCategory ---
    cols = get_columns('subcategory')
    if 'name_so' in cols:
        op.drop_column('subcategory', 'name_so')
    if 'name_en' in cols:
        op.alter_column('subcategory', 'name_en', new_column_name='name')
    
    # --- Category ---
    cols = get_columns('category')
    if 'name_so' in cols:
        op.drop_column('category', 'name_so')
    if 'name_en' in cols:
        op.alter_column('category', 'name_en', new_column_name='name')
