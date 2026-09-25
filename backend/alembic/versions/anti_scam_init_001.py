"""Add anti-scam infrastructure tables and fields

Revision ID: anti_scam_init_001
Revises: merge_heads_002
Create Date: 2026-05-13 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'anti_scam_init_001'
down_revision = 'merge_heads_002'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. Create Device Table
    if 'device' not in existing_tables:
        op.create_table('device',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('fingerprint_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('metadata', sa.JSON(), nullable=True),
            sa.Column('is_banned', sa.Boolean(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('last_seen_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_device_fingerprint_hash'), 'device', ['fingerprint_hash'], unique=True)

    # 2. Create UserDeviceLink Table
    if 'userdevicelink' not in existing_tables:
        op.create_table('userdevicelink',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['device_id'], ['device.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # 3. Create FraudEvent Table
    if 'fraudevent' not in existing_tables:
        op.create_table('fraudevent',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('target_type', sa.Enum('USER', 'LISTING', 'MESSAGE', 'DEVICE', name='fraudtargettype'), nullable=False),
            sa.Column('target_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('rule_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('risk_score', sa.Integer(), nullable=False),
            sa.Column('confidence', sa.Float(), nullable=False),
            sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('event_data', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_fraudevent_target_id'), 'fraudevent', ['target_id'], unique=False)

    # 4. Create RiskHistory Table
    if 'riskhistory' not in existing_tables:
        op.create_table('riskhistory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('previous_score', sa.Integer(), nullable=False),
        sa.Column('new_score', sa.Integer(), nullable=False),
        sa.Column('reason', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Add fields to User
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    user_columns = [col['name'] for col in inspector.get_columns('user')]
    if 'trust_score' not in user_columns:
        op.add_column('user', sa.Column('trust_score', sa.Integer(), nullable=False, server_default='500'))
        op.create_index(op.f('ix_user_trust_score'), 'user', ['trust_score'], unique=False)
    
    if 'trust_level' not in user_columns:
        op.add_column('user', sa.Column('trust_level', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='NEW'))
    
    if 'is_flagged' not in user_columns:
        op.add_column('user', sa.Column('is_flagged', sa.Boolean(), nullable=False, server_default='0'))

    # 6. Add fields to Listing
    listing_columns = [col['name'] for col in inspector.get_columns('listing')]
    if 'image_hashes' not in listing_columns:
        op.add_column('listing', sa.Column('image_hashes', sa.JSON(), nullable=True))
    
    if 'fraud_risk_score' not in listing_columns:
        op.add_column('listing', sa.Column('fraud_risk_score', sa.Integer(), nullable=False, server_default='0'))
        op.create_index(op.f('ix_listing_fraud_risk_score'), 'listing', ['fraud_risk_score'], unique=False)
        
    if 'fraud_flags' not in listing_columns:
        op.add_column('listing', sa.Column('fraud_flags', sa.JSON(), nullable=True))


def downgrade():
    op.drop_index(op.f('ix_listing_fraud_risk_score'), table_name='listing')
    op.drop_column('listing', 'fraud_flags')
    op.drop_column('listing', 'fraud_risk_score')
    op.drop_column('listing', 'image_hashes')
    op.drop_index(op.f('ix_user_trust_score'), table_name='user')
    op.drop_column('user', 'is_flagged')
    op.drop_column('user', 'trust_level')
    op.drop_column('user', 'trust_score')
    op.drop_table('riskhistory')
    op.drop_index(op.f('ix_fraudevent_target_id'), table_name='fraudevent')
    op.drop_table('fraudevent')
    op.drop_table('userdevicelink')
    op.drop_index(op.f('ix_device_fingerprint_hash'), table_name='device')
    op.drop_table('device')
    op.execute('DROP TYPE fraudtargettype')
