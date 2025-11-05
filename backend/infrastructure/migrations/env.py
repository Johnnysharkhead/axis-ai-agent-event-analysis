import logging
from logging.config import fileConfig

from flask import current_app
from alembic import context
from sqlalchemy import engine_from_config, pool

# Alembic Config object
config = context.config
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# --- Flask-Migrate / SQLAlchemy integration ---
try:
    db = current_app.extensions['migrate'].db
except KeyError:
    raise RuntimeError(
        "Flask-Migrate is not initialized correctly. "
        "Ensure you call Migrate(app, db) in your app factory."
    )

# Force Alembic to load your full metadata from all models
# This ensures FK names are visible and no 'Constraint must have a name' occurs
from models import (
    User, InviteKey, Room, Camera, Recording, Metadata, Snapshot
)

target_metadata = db.metadata

# Set DB URL
config.set_main_option('sqlalchemy.url', str(db.engine.url).replace('%', '%%'))

# --- Migration run modes ---

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""

    def process_revision_directives(context, revision, directives):
        # Prevent empty migrations
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info("No schema changes detected.")

    connectable = db.engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives,
            compare_type=True,       # detect type changes
            compare_server_default=True,  # detect default value changes
            render_as_batch=True,    # ensures safe ALTER TABLE on SQLite
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
