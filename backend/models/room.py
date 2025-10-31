from . import db

class Room(db.Model):
    __tablename__ = "rooms"
        
    id      = db.Column(db.Integer, primary_key = True)
    name    = db.Column(db.String(30), nullable = False)
        
    cameras = db.relationship("Camera", back_populates = "room", cascade = "all, delete-orphan")

    def serialize(self):

        return {
            "id" : self.id,
             "name" : self.name,
            "cameras" : {
                [camera.serialize() for camera in self.cameras]
            }
        }
