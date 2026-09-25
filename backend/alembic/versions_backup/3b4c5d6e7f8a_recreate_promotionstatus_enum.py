"""Recreate promotionstatus enum with lowercase values only

Revision ID: 3b4c5d6e7f8a
Revises: 2a3b4c5d6e7f
Create Date: 2026-02-18 23:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '3b4c5d6e7f8a'
down_revision = '2a3b4c5d6e7f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add a temporary text column
    op.add_column('promotion', sa.Column('status_text', sa.String(), nullable=True))
    
    # Step 2: Copy current status values as lowercase text
    op.execute("UPDATE promotion SET status_text = LOWER(status::text)")
    
    # Step 3: Drop the old status column
    op.drop_column('promotion', 'status')
    
    # Step 4: Drop the old enum type
    op.execute("DROP TYPE IF EXISTS promotionstatus")
    
    # Step 5: Create the new enum type with only lowercase values
    op.execute("""
        CREATE TYPE promotionstatus AS ENUM (
            'waiting_for_payment',
            'pending',
            'paid',
            'submitted',
            'approved',
            'rejected',
            'expired'
        )
    """)
    
    # Step 6: Add the new status column using the new enum type
    op.add_column('promotion', sa.Column('status', sa.Enum(
        'waiting_for_payment', 'pending', 'paid', 'submitted', 'approved', 'rejected', 'expired',
        name='promotionstatus'
    ), nullable=True))
    
    # Step 7: Populate from the text column
    op.execute("UPDATE promotion SET status = status_text::promotionstatus")
    
    # Step 8: Set NOT NULL and default
    op.alter_column('promotion', 'status', nullable=False)
    
    # Step 9: Drop the temporary text column
    op.drop_column('promotion', 'status_text')


def downgrade() -> None:
    pass
