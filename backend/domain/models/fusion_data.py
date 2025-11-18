from . import db


class FusionData(db.Model):
    """
    Stores a single fusion event coming from the MQTT fusion topic.
    We persist a flattened subset of the payload for easy querying together with
    the raw observation list so we do not lose any details.
    """

    __tablename__ = "fusion_data"

    id = db.Column(db.Integer, primary_key=True)
    camera_serial = db.Column(db.String(64), nullable=False, index=True)
    track_id = db.Column(db.String(64), nullable=False, index=True)
    confidence = db.Column(db.Float)

    # Class details
    class_type = db.Column(db.String(32))
    class_score = db.Column(db.Float)
    upper_clothing_colors = db.Column(db.JSON)
    lower_clothing_colors = db.Column(db.JSON)

    # Spatial data
    bounding_box_top = db.Column(db.Float)
    bounding_box_bottom = db.Column(db.Float)
    bounding_box_left = db.Column(db.Float)
    bounding_box_right = db.Column(db.Float)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    # Temporal data
    start_time = db.Column(db.DateTime(timezone=True))
    event_timestamp = db.Column(db.DateTime(timezone=True))

    observations = db.Column(db.JSON)  # Raw per-frame bounding boxes

    # Base64 encoded snapshot taken at highest confidence (if provided)
    snapshot_base64 = db.Column(db.Text)

    raw_payload = db.Column(db.JSON)

    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=db.func.now()
    )

    def serialize(self):
        """Return a JSON-serializable representation used by REST responses."""
        return {
            "id": self.id,
            "camera_serial": self.camera_serial,
            "track_id": self.track_id,
            "confidence": self.confidence,
            "class": {
                "type": self.class_type,
                "score": self.class_score,
                "upper_clothing_colors": self.upper_clothing_colors,
                "lower_clothing_colors": self.lower_clothing_colors,
            },
            "bounding_box": {
                "top": self.bounding_box_top,
                "bottom": self.bounding_box_bottom,
                "left": self.bounding_box_left,
                "right": self.bounding_box_right,
            },
            "geoposition": {
                "latitude": self.latitude,
                "longitude": self.longitude,
            },
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "event_timestamp": self.event_timestamp.isoformat()
            if self.event_timestamp
            else None,
            "observations": self.observations,
            "snapshot_base64": self.snapshot_base64,
            "raw_payload": self.raw_payload,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
