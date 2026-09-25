"""Create listing_report table

The model (app/models/report.py, ListingReport) and the POST /listings/report
endpoint have existed for a while, but no migration ever created this table --
every report submission was hitting an unhandled "relation listing_report
does not exist" error (surfaced to the client as a bare 500).

Revision ID: listing_report_001
Revises:
Create Date: 2026-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'listing_report_001'
down_revision = '20260812_add_brands'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'listing_report',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('reporter_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['listing_id'], ['listing.id'], ),
        sa.ForeignKeyConstraint(['reporter_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_listing_report_listing_id', 'listing_report', ['listing_id'])
    op.create_index('ix_listing_report_reporter_id', 'listing_report', ['reporter_id'])


def downgrade() -> None:
    op.drop_index('ix_listing_report_reporter_id', table_name='listing_report')
    op.drop_index('ix_listing_report_listing_id', table_name='listing_report')
    op.drop_table('listing_report')
