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

    id          = db.Column(db.Integer, primary_key = True)
    room_id     = db.Column(db.Integer, db.ForeignKey("rooms.id"), name=fk_name("camera", "room_id"), nullable = False)

    room        = db.relationship("Room", back_populates = "cameras")
    # recordings  = db.relationship("Recording", back_populates = "camera", cascade = "all, delete-orphan")

    def serialize(self, context=None):
        data = {
            "id": self.id,
            "room_id": self.room_id,
        }
        if context == "big":

            data["room"] = self.room.serialize()
            data["recordings"] = [rec.serialize() for rec in self.recordings]
        elif context == "small":
            data["name"] = getattr(self, "name", None)
        # base case (context is None)
        return data