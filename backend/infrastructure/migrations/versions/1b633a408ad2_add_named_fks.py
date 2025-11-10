"""Add named FKs

Revision ID: 1b633a408ad2
Revises: a8acbaeeb50b
Create Date: 2025-10-31

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1b633a408ad2'
down_revision = 'a8acbaeeb50b'
branch_labels = None
depends_on = None


def upgrade():
    # --- Cameras ---
    with op.batch_alter_table('cameras', schema=None) as batch_op:
        # just create a named FK, don't drop anything
        batch_op.create_foreign_key(
            "fk_camera_room_id",
            "rooms",
            ["room_id"],
            ["id"]
        )

    # --- Metadata ---
    with op.batch_alter_table('metadata', schema=None) as batch_op:
        batch_op.create_foreign_key(
            "fk_metadata_recording_id",
            "recordings",
            ["recording_id"],
            ["recording_id"]
        )

    # --- Snapshots ---
    with op.batch_alter_table('snapshots', schema=None) as batch_op:
        batch_op.create_foreign_key(
            "fk_snapshot_recording_id",
            "recordings",
            ["recording_id"],
            ["recording_id"]
        )


def downgrade():
    # --- Snapshots ---
    with op.batch_alter_table('snapshots', schema=None) as batch_op:
        batch_op.drop_constraint("fk_snapshot_recording_id", type_='foreignkey')

    # --- Metadata ---
    with op.batch_alter_table('metadata', schema=None) as batch_op:
        batch_op.drop_constraint("fk_metadata_recording_id", type_='foreignkey')

    # --- Cameras ---
    with op.batch_alter_table('cameras', schema=None) as batch_op:
        batch_op.drop_constraint("fk_camera_room_id", type_='foreignkey')
