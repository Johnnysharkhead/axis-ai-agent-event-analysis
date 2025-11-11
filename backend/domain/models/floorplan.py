from . import db

class Floorplan(db.Model):
    """
    Initial Class for storing rooms in the database.
    Not currently used. Unsure if it will be used in the future.
    May be beneficial if user wants to search for recordings from a specific room.
    """
    __tablename__ = "floorplans"
        
    id                 = db.Column(db.Integer, primary_key = True)
    name               = db.Column(db.String(30), nullable = False)
    width              = db.Column(db.Float, nullable = False)
    depth              = db.Column(db.Float, nullable = False)
    camera_height      = db.Column(db.Float, nullable = True)
    corner_coordinates = db.Column(db.JSON, nullable = True)

    cameras = db.relationship("Camera", back_populates = "floorplan", cascade = "all, delete-orphan")

    def serialize(self):

        return {
            "id": self.id,
            "name": self.name,
            "width": self.width,
            "depth": self.depth,
            "cameras": [camera.serialize() for camera in self.cameras] if self.cameras else None
        }
