from . import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import hashlib
import secrets

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
    is_admin = db.Column(db.Boolean, default=False, nullable=True)
    is_blocked = db.Column(db.Boolean, default=False, nullable=True)
        
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
            'is_admin': self.is_admin,
            'is_blocked': self.is_blocked,
            'failed_login_attempts': self.failed_login_attempts,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
    
class InviteKey(db.Model):
    __tablename__ = 'invite_keys'
    id = db.Column(db.Integer, primary_key=True)
    key_hash = db.Column(db.String(128), unique=True, nullable=False)
    #used = db.Column(db.Boolean, default=False)
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
        invite = InviteKey.query.filter_by(key_hash=key_hash).first()
            
        if not invite:
            return None
            
        
            
        return invite
