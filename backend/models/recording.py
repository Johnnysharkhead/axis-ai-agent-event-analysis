from . import db
from datetime import datetime

class Recording(db.Model):
    __tablename__ = "recordings"

    recording_id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(100), nullable=False)
    """
    Recordings should have url links to snapshots pertaining to that recording. Not yet implemented.
    """
    snapshot_url = db.Column(db.String(100)) 

    recording_metadata = db.relationship("Metadata", back_populates="recording", cascade="all, delete-orphan")
        
    # camera_id       = db.Column(db.Integer, db.ForeignKey("cameras.id"), nullable = False)
        
    # camera      = db.relationship("Camera", back_populates = "recordings")

    def serialize(self):
        id_to_str = str(self.recording_id)
        timestamp = id_to_str[1:]
        dt = datetime.strptime(timestamp, "%Y%m%d%H%M%S")
        formatted = dt.strftime("%Y-%m-%d_%H:%M:%S")
        return {
            "recording_id": self.recording_id,
            "url": self.url,
            "timestamp": formatted
        }