"""
models.py
Database models for the application, including the User model for authentication.
Authors: Victor, David, Success
This module is designed to be easy to understand and extend for future models.
"""
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import hashlib
import secrets


db = None

def init_models(db):
    """
    Initialize models with database instance.
    Call this from main.py after creating db.
    """

    
    
    class User(UserMixin, db.Model):
        """
        User model for authentication.
        
        UserMixin adds Flask-Login properties:
            - is_authenticated
            - is_active
            - is_anonymous
            - get_id()
        """
        __tablename__ = 'users'
        
        # Columns
        id = db.Column(db.Integer, primary_key=True)
        username = db.Column(db.String(80), unique=True, nullable=False, index=True)
        email = db.Column(db.String(120), unique=True, nullable=False, index=True)
        password_hash = db.Column(db.String(255), nullable=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        last_login = db.Column(db.DateTime)
        invite_key_id = db.Column(db.Integer, nullable=True)
        failed_login_attempts = db.Column(db.Integer, default=0)
        last_failed_login = db.Column(db.DateTime, nullable=True)
        
        def set_password(self, password):
            """Hash and store password"""
            self.password_hash = generate_password_hash(password)
        
        def check_password(self, password):
            """Verify password against hash"""
            return check_password_hash(self.password_hash, password)
        
        def to_dict(self):
            """Convert user to dictionary for API responses"""
            return {
                'id': self.id,
                'username': self.username,
                'email': self.email,
                'created_at': self.created_at.isoformat() if self.created_at else None,
                'last_login': self.last_login.isoformat() if self.last_login else None
            }
        
    class InviteKey(db.Model):
        __tablename__ = 'invite_keys'
        id = db.Column(db.Integer, primary_key=True)
        key_hash = db.Column(db.String(128), unique=True, nullable=False)
        used = db.Column(db.Boolean, default=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
       

        @staticmethod
        def generate_key():
            import secrets, hashlib
            raw_key = secrets.token_urlsafe(32)
            key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
            from datetime import datetime, timedelta
            
            return raw_key, key_hash
        
        @staticmethod
        def verify_key(raw_key):
            """Verify if an invite key is valid"""
            if not raw_key:
                return None
            key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
            invite = InviteKey.query.filter_by(key_hash=key_hash, used=False).first()
            
            if not invite:
                return None
            
        
            
            return invite
        
    class Room(db.Model):
        __tablename__ = "rooms"

        id      = db.Column(db.Integer, primary_key = True)
        name    = db.Column(db.String(30), nullable = False)
        
        cameras = db.relationship("Camera", back_populates = "room", cascade = "all, delete-orphan")

        def serialize(self):

            return {
                "id" : self.id,
                "name" : self.name,
                "cameras" : {
                    [camera.serialize() for camera in self.cameras]
                }
            }


    # Camera describes a physical camera in a room
    class Camera(db.Model):
        __tablename__ = "cameras"

        id          = db.Column(db.Integer, primary_key = True)
        room_id     = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable = False)

        room        = db.relationship("Room", back_populates = "cameras")
        recordings  = db.relationship("Recording", back_populates = "camera", cascade = "all, delete-orphan")

        def serialize(self, context=None):
            data = {
                "id": self.id,
                "room_id": self.room_id,
            }
            if context == "big":

                data["room"] = self.room.serialize()
                data["recordings"] = [rec.serialize() for rec in self.recordings]
            elif context == "small":
                data["name"] = getattr(self, "name", None)
            # base case (context is None)
            return data

    # Recording describes a videao recording from a camera 
    class Recording(db.Model):
        __tablename__ = "recordings"

        id          = db.Column(db.Integer, primary_key = True)
        url         = db.Column(db.String(100), nullable = False)
        camera_id   = db.Column(db.Integer, db.ForeignKey("cameras.id"), nullable = False)

        camera      = db.relationship("Camera", back_populates = "recordings")

        recording_metadata = db.relationship("Metadata", back_populates="recording_metadata", uselist=False)
    # Metadata describes metadata associated with a recording
    class Metadata(db.Model):
        __tablename__ = "metadata"

        id          = db.Column(db.Integer, primary_key = True)
        recording_id= db.Column(db.Integer, db.ForeignKey("recordings.id"), nullable = False, unique = True)

        recording_metadata = db.relationship("Recording", back_populates="recording_metadata")


    return User, InviteKey, Room, Camera, Recording, Metadata