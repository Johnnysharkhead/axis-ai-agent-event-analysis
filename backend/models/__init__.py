from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .user import User, InviteKey
from .room import Room
from .camera import Camera
from .recording import Recording, Metadata, Snapshot

# def fk_name(table, column):
#     return f"fk_{table}_{column}"