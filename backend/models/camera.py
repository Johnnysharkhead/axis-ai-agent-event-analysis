from . import db

def fk_name(table, column):
    return f"fk_{table}_{column}"

class Camera(db.Model):
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