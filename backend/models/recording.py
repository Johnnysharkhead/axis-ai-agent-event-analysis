from . import db

def fk_name(table, column):
    return f"fk_{table}_{column}"

from datetime import datetime

class Recording(db.Model):
    __tablename__ = "recordings"

    recording_id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(100), nullable=False)

    snapshots = db.relationship("Snapshot", back_populates="recording", cascade="all, delete-orphan")
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
    

class Snapshot(db.Model):
    __tablename__ = "snapshots"
    id = db.Column(db.Integer, primary_key = True)
    recording_id = db.Column(db.Integer, db.ForeignKey("recordings.recording_id"), name=fk_name("snapshot", "recording_id"), nullable=False)
    url = db.Column(db.String(200), nullable = False)
    timestamp = db.Column(db.DateTime, default = datetime.utcnow)

    recording = db.relationship("Recording", back_populates = "snapshots")


class Metadata(db.Model):
    """
    How one JSON instance of Object Analytics looks like:
    
    axis/B8A44F9EED3B/event/CameraApplicationPlatform/ObjectAnalytics/Device1ScenarioANY 

    {"topic" : "axis:CameraApplicationPlatform/ObjectAnalytics/Device1ScenarioANY",
    "timestamp" : 1760689684528,
    "serial" : "B8A44F9EED3B",
    "message" : {
        "source" : {},
        "key" : {},
        "data" : {
            "triggerTime" : "2025-10-17T10:28:04.528+0200",
            "active" : "1",
            "objectId" : "4240",
            "classTypes" : "human"
            }
        }
    } 
    """

    __tablename__ = "metadata"

    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String)
    timestamp = db.Column(db.BigInteger)
    serial = db.Column(db.String)
    message_source = db.Column(db.JSON)
    message_key = db.Column(db.JSON)
    data_trigger_time = db.Column(db.DateTime(timezone=True), nullable=False)
    data_active = db.Column(db.Boolean)
    data_object_id = db.Column(db.String)
    data_class_types = db.Column(db.String)

    recording_id = db.Column(db.Integer, db.ForeignKey("recordings.recording_id"), name=fk_name("metadata", "recording_id"), nullable=False)
    recording = db.relationship("Recording", back_populates="recording_metadata")


