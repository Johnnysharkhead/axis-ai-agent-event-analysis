from . import db
from datetime import datetime
#for heatmap, can probably be used for storing an intruders movement later
class PositionHistory(db.Model):
   
    __tablename__ = "position_history"

    id = db.Column(db.Integer, primary_key=True)
    track_id = db.Column(db.String(50), nullable=False, index=True)
    x_m = db.Column(db.Float, nullable=False)
    y_m = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    floorplan_id = db.Column(db.Integer, db.ForeignKey('floorplans.id'), nullable=True)

    floorplan = db.relationship("Floorplan", backref="position_history")

    def __repr__(self):
        return f"<PositionHistory {self.track_id} at ({self.x_m}, {self.y_m}) @ {self.timestamp}>"

    def serialize(self):
        return {
            "id": self.id,
            "track_id": self.track_id,
            "x_m": self.x_m,
            "y_m": self.y_m,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "floorplan_id": self.floorplan_id
        }
