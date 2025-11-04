from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class EventLog(db.Model):
    __tablename__ = "event_logs"

    id = db.Column(db.Integer, primary_key=True)

    # Relationship with recordings
    recordings = db.relationship("Recording", back_populates="event", cascade="all, delete-orphan")


    def serialize(self):
        """Convert the event log to a dictionary."""
        return {
            "id": self.id,
        }