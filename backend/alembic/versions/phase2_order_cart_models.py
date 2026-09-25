"""Add Order and Cart models for Phase 2 implementation

Revision ID: phase2_order_cart
Revises: perf_001
Create Date: 2026-07-06 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'phase2_order_cart'
down_revision = 'perf_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create order table
    op.create_table(
        'order',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('business_id', sa.String(), nullable=True),
        sa.Column('fulfillment_type', sa.String(), nullable=False),
        sa.Column('address_id', sa.Integer(), nullable=True),
        sa.Column('delivery_notes', sa.String(), nullable=True),
        sa.Column('pickup_notes', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=True),
        sa.Column('delivery_id', sa.Integer(), nullable=True),
        sa.Column('subtotal', sa.Float(), nullable=False),
        sa.Column('service_fee', sa.Float(), nullable=False),
        sa.Column('delivery_fee', sa.Float(), nullable=False),
        sa.Column('courier_tip', sa.Float(), nullable=False),
        sa.Column('discount_amount', sa.Float(), nullable=False),
        sa.Column('tax_amount', sa.Float(), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('customer_phone', sa.String(), nullable=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('admin_notes', sa.String(), nullable=True),
        sa.Column('extra_info', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('shipped_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['seller_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['rider_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['address_id'], ['savedaddress.id'], ),
        sa.ForeignKeyConstraint(['delivery_id'], ['delivery.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_business_id'), 'order', ['business_id'], unique=False)
    op.create_index(op.f('ix_order_customer_id'), 'order', ['customer_id'], unique=False)
    op.create_index(op.f('ix_order_seller_id'), 'order', ['seller_id'], unique=False)
    op.create_index(op.f('ix_order_status'), 'order', ['status'], unique=False)
    op.create_index(op.f('ix_order_created_at'), 'order', ['created_at'], unique=False)

    # Create orderitem table
    op.create_table(
        'orderitem',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('subtotal', sa.Float(), nullable=False),
        sa.Column('product_title', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['order.id'], ),
        sa.ForeignKeyConstraint(['product_id'], ['listing.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orderitem_order_id'), 'orderitem', ['order_id'], unique=False)
    op.create_index(op.f('ix_orderitem_product_id'), 'orderitem', ['product_id'], unique=False)

    # Create cart table
    op.create_table(
        'cart',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('promo_code', sa.String(), nullable=True),
        sa.Column('promo_discount_amount', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.UniqueConstraint('user_id'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cart_user_id'), 'cart', ['user_id'], unique=True)
    op.create_index(op.f('ix_cart_promo_code'), 'cart', ['promo_code'], unique=False)

    # Create cartitem table
    op.create_table(
        'cartitem',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cart_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('price_at_add', sa.Float(), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['cart_id'], ['cart.id'], ),
        sa.ForeignKeyConstraint(['product_id'], ['listing.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cartitem_cart_id'), 'cartitem', ['cart_id'], unique=False)
    op.create_index(op.f('ix_cartitem_product_id'), 'cartitem', ['product_id'], unique=False)


def downgrade() -> None:
    # Drop cartitem table
    op.drop_index(op.f('ix_cartitem_product_id'), table_name='cartitem')
    op.drop_index(op.f('ix_cartitem_cart_id'), table_name='cartitem')
    op.drop_table('cartitem')

    # Drop cart table
    op.drop_index(op.f('ix_cart_promo_code'), table_name='cart')
    op.drop_index(op.f('ix_cart_user_id'), table_name='cart')
    op.drop_table('cart')

    # Drop orderitem table
    op.drop_index(op.f('ix_orderitem_product_id'), table_name='orderitem')
    op.drop_index(op.f('ix_orderitem_order_id'), table_name='orderitem')
    op.drop_table('orderitem')

    # Drop order table
    op.drop_index(op.f('ix_order_created_at'), table_name='order')
    op.drop_index(op.f('ix_order_status'), table_name='order')
    op.drop_index(op.f('ix_order_seller_id'), table_name='order')
    op.drop_index(op.f('ix_order_customer_id'), table_name='order')
    op.drop_index(op.f('ix_order_business_id'), table_name='order')
    op.drop_table('order')
