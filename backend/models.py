"""
models.py
Database models for the application, including the User model for authentication.
Authors: Victor, David, Success
This module is designed to be easy to understand and extend for future models.
"""
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

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
    
    return User