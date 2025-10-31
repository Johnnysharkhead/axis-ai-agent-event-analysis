from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .user import User, InviteKey
from .room import Room
from .camera import Camera
from .recording import Recording
from .metadata import Metadata