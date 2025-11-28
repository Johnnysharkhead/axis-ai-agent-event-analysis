"""
This module initializes the SQLAlchemy database instance and imports all model classes
for use throughout the application. By importing the models here, they are automatically
registered with SQLAlchemy when the application is initialized, allowing for easier
database migrations and consistent access to model definitions.

Models imported:
- User, InviteKey (from user.py)
- Room (from room.py)
- Camera (from camera.py)
- Recording, Metadata, Snapshot, EventLog (from recording.py)
- FusionData (from fusion_data.py)
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .user import User, InviteKey
from .room import Room
from .camera import Camera
from .recording import Recording, Metadata, Snapshot, EventLog
from .fusion_data import FusionData
from .daily_summary import DailySummary
from .floorplan import Floorplan
from .zone import Zone
from .position_history import PositionHistory
from .zone import Zone
