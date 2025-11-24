from . import db

def fk_name(table, column) -> str:
    """
    Method for naming foreignkeys and other constraints to facilitate migration.
    """
    return f"fk_{table}_{column}"

from datetime import datetime

event_recordings = db.Table(
    "event_recordings",
    db.Column("event_id", db.Integer, db.ForeignKey("event_logs.id"), primary_key=True),
    db.Column("recording_id", db.BigInteger, db.ForeignKey("recordings.recording_id"), primary_key=True),
)

class Recording(db.Model):
    """
    Class for storing Recording data in the database.
    A recording object does not store the actual videofile or any potential snapshots.
    It stores URL:s in the filesystem to the recording and eventual snapshots.

        A recording object of the database will initially include:
    - Recording ID: A concatenated integer consisting of the camera ID and the timestamp of the recording
        * For example, if a recording was done on the date 18/10-2025 at the time 16:24:35 on camera number 1,
          the ID of the recording will be 120251018162435, stored as a db.Integer.

    - Recording URL: The filepath of the recording. This will automatically be created at backend/recordings.
        * For every new recording, a separate folder for that recording will be created
        * The recording example above will have the following folder URL:
            - backend/recordings/recording_20251018_121055

    - Recording also has a 1-to-N relationship with both the class Snapshot and the class Metadata.
    """
    __tablename__ = "recordings"

    recording_id = db.Column(db.BigInteger, primary_key=True)  # CHANGED: Integer -> BigInteger
    url = db.Column(db.String(100), nullable=False)

    snapshots = db.relationship("Snapshot", back_populates="recording", cascade="all, delete-orphan")
    recording_metadata = db.relationship("Metadata", back_populates="recording", cascade="all, delete-orphan")

     # MANY-TO-MANY relation to EventLog
    events = db.relationship(
        "EventLog",
        secondary="event_recordings",
        back_populates="recordings"
    )

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
    """
    Class for storing snapshots (images) pertaining to a certain recording
    These snapshots will also be stored as images in the local file system.
    The URL of a snapshot is the filepath to that image in the user's filesystem.
    
    recording_id is the foreign key to the recording on which the snapshots are based on.

    One Recording object can have many snapshots. 
    """
    __tablename__ = "snapshots"
    id = db.Column(db.Integer, primary_key = True)
    recording_id = db.Column(db.BigInteger, db.ForeignKey("recordings.recording_id"), name=fk_name("snapshot", "recording_id"), nullable=False)  # CHANGED: Integer -> BigInteger
    url = db.Column(db.String(200), nullable = False)
    timestamp = db.Column(db.DateTime, default = datetime.utcnow)

    recording = db.relationship("Recording", back_populates = "snapshots")


class Metadata(db.Model):
    """
    Metadata pertaining to a Recording object. 
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

    recording_id = db.Column(db.BigInteger, db.ForeignKey("recordings.recording_id"), name=fk_name("metadata", "recording_id"), nullable=False)  # CHANGED: Integer -> BigInteger
    recording = db.relationship("Recording", back_populates="recording_metadata")

class EventLog(db.Model):
    __tablename__ = "event_logs"

    id = db.Column(db.Integer, primary_key=True)

    #FK to Zone
    #zone_id = db.Column(
    #    db.Integer,
    #    db.ForeignKey("zones.id", name=fk_name("event_logs", "zone_id")),
    #    nullable=True,
    #)

    #Relationship with zones
    #zone = db.relationship("Zone", back_populates="event_logs")

    # MANY-TO-MANY relation to Recordings
    recordings = db.relationship(
        "Recording",
        secondary="event_recordings",
        back_populates="events",
        cascade="all"
    )

    def serialize(self):
        """Convert the event log to a dictionary."""
        return {
            "id": self.id,
            #"zone_id": self.zone_id,
            "recording_ids": [r.recording_id for r in self.recordings],
        }
