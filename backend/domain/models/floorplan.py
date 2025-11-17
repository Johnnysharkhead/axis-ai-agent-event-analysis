from . import db
from sqlalchemy.ext.mutable import MutableDict

class Floorplan(db.Model):
    """
    Initial Class for storing rooms in the database.
    Not currently used. Unsure if it will be used in the future.
    May be beneficial if user wants to search for recordings from a specific room.
    """
    __tablename__ = "floorplans"
        
    id                          = db.Column(db.Integer, primary_key = True)
    name                        = db.Column(db.String(30), nullable = False)
    width                       = db.Column(db.Float, nullable = False)
    depth                       = db.Column(db.Float, nullable = False)
    camera_height               = db.Column(db.Float, nullable = True)
    corner_geocoordinates       = db.Column(db.JSON, nullable = True)
    # camera_floorplancoordinates = db.Column(db.JSON, nullable = True)
    camera_floorplancoordinates = db.Column(MutableDict.as_mutable(db.JSON), nullable=True)

    cameras = db.relationship("Camera", back_populates = "floorplan")

    def serialize(self):
        def tuple_to_list_dict(d):
            if not d or not isinstance(d, dict):
                return {}
            return {k: list(v) for k, v in d.items()}
        
        def coords_to_list(coords):
            if coords is None:
                return None
            return list(coords) if isinstance(coords, (tuple, list)) else coords
        return {
            "id": self.id,
            "name": self.name,
            "width": self.width,
            "depth": self.depth,
            "corner_geocoordinates": tuple_to_list_dict(self.corner_geocoordinates),
            "cameras" : [camera.serialize() for camera in self.cameras] if self.cameras else None,
            "camera_floorplancoordinates" : tuple_to_list_dict(self.camera_floorplancoordinates),
        }
