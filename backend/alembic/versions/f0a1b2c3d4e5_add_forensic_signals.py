"""add forensic signals to user and report

Revision ID: f0a1b2c3d4e5
Revises: c8b2d3e4f5g6
Create Date: 2026-05-09 13:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'f0a1b2c3d4e5'
down_revision = 'c8b2d3e4f5g6'
branch_labels = None
depends_on = None

def get_columns(table_name):
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    return {c['name'] for c in inspector.get_columns(table_name)}

def upgrade():
    # User forensic fields
    user_cols = get_columns('user')
    if 'device_fingerprint' not in user_cols:
        op.add_column('user', sa.Column('device_fingerprint', sa.String(), nullable=True))
        op.create_index(op.f('ix_user_device_fingerprint'), 'user', ['device_fingerprint'], unique=False)
    if 'last_ip' not in user_cols:
        op.add_column('user', sa.Column('last_ip', sa.String(), nullable=True))
    
    # Report forensic fields
    report_cols = get_columns('report')
    for col, type_ in [
        ('reporter_ip', sa.String()),
        ('reporter_fingerprint', sa.String()),
        ('offender_ip', sa.String()),
        ('offender_fingerprint', sa.String()),
        ('risk_score', sa.Integer()),
    ]:
        if col not in report_cols:
            server_default = '0' if col == 'risk_score' else None
            op.add_column('report', sa.Column(col, type_, nullable=True, server_default=server_default))

def downgrade():
    # User forensic fields
    op.drop_index(op.f('ix_user_device_fingerprint'), table_name='user')
    op.drop_column('user', 'last_ip')
    op.drop_column('user', 'device_fingerprint')
    
    # Report forensic fields
    for col in ['risk_score', 'offender_fingerprint', 'offender_ip', 'reporter_fingerprint', 'reporter_ip']:
        op.drop_column('report', col)
