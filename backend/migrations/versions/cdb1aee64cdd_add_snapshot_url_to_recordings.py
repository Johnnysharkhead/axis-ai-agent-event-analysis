"""Add snapshot_url to recordings

Revision ID: cdb1aee64cdd
Revises: 
Create Date: 2025-10-31 13:58:22.395353

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'cdb1aee64cdd'
down_revision = None  # or set to your previous migration ID if you have one
branch_labels = None
depends_on = None


def upgrade():
    # Only add snapshot_url to recordings
    with op.batch_alter_table('recordings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('snapshot_url', sa.String(length=100), nullable=True))


def downgrade():
    # Only remove snapshot_url
    with op.batch_alter_table('recordings', schema=None) as batch_op:
        batch_op.drop_column('snapshot_url')
