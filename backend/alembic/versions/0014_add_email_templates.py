"""Add email template management table.

Revision ID: 0014_email_templates
Revises: 0013_marketing
Create Date: 2026-07-30

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '0014_email_templates'
down_revision = '0013_marketing'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create email_template table
    op.create_table(
        'email_template',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('html_content', sa.Text(), nullable=False),
        sa.Column('text_content', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('variables', sa.String(), nullable=True),  # JSON array
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True, foreign_key="user.id"),
        sa.Column('updated_by', sa.Integer(), nullable=True, foreign_key="user.id"),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_email_template_event_type', 'email_template', ['event_type'])


def downgrade() -> None:
    op.drop_index('ix_email_template_event_type', table_name='email_template')
    op.drop_table('email_template')
