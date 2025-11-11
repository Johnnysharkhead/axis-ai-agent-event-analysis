from . import db

def fk_name(table, column) -> str:
    """
    Method for naming foreignkeys and other constraints to facilitate migration.
    """
    return f"fk_{table}_{column}"

class Camera(db.Model):
    """
    Initial Class for storing cameras in the database.
    Not currently used. Unsure if it will be used in the future.
    May be beneficial if user wants to search for recordings from a specific camera.
    """
    __tablename__ = "cameras"

    id               = db.Column(db.Integer, primary_key = True)
    floorplan_id = db.Column(
        db.Integer,
        db.ForeignKey("floorplans.id", name=fk_name("camera", "floorplan_id"), ondelete="SET NULL"),
        nullable=True
    )
    ip_address       = db.Column(db.String, unique = True, nullable = False)
    lat = db.Column(db.Numeric(18, 15), nullable=True)
    lon = db.Column(db.Numeric(18, 15), nullable=True) 
    serialno         = db.Column(db.String, nullable  = True)
    
    floorplan        = db.relationship("Floorplan", back_populates = "cameras")
    # recordings  = db.relationship("Recording", back_populates = "camera", cascade = "all, delete-orphan")

    def serialize(self):
        return {
            "id" : self.id,
            "floorplan_id" : self.floorplan_id if self.floorplan_id else None,
            "ip_address" : self.ip_address,
            "lat" : self.lat if self.lat else None,
            "lon" : self.lon if self.lon else None,
            "serialno" : self.serialno
        }
