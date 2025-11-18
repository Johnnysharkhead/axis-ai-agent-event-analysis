from . import db
from datetime import datetime
import json

class Zone(db.Model):
    """
    Zone model stores polygon coordinates (GeoJSON-like array of points)
    and computed bbox/centroid for fast checks. Provides contains_point().
    """
    __tablename__ = "zones"

    id = db.Column(db.Integer, primary_key=True)
    floorplan_id = db.Column(db.Integer, nullable=True)
    name = db.Column(db.String(64), nullable=True)
    coordinates = db.Column(db.JSON, nullable=False)  # list of {x:..., y:...}
    bbox = db.Column(db.JSON, nullable=True)           # [minX, minY, maxX, maxY]
    centroid = db.Column(db.JSON, nullable=True)       # {x, y}
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def serialize(self):
        return {
            "id": self.id,
            "floorplan_id": self.floorplan_id,
            "name": self.name,
            "points": self.coordinates,
            "bbox": self.bbox,
            "centroid": self.centroid,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    # --- geometry helpers ---
    @staticmethod
    def compute_meta(points):
        if not points:
            return {"bbox": [0, 0, 0, 0], "centroid": {"x": 0, "y": 0}}
        min_x = min(p["x"] for p in points)
        min_y = min(p["y"] for p in points)
        max_x = max(p["x"] for p in points)
        max_y = max(p["y"] for p in points)
        sx = sum(p["x"] for p in points)
        sy = sum(p["y"] for p in points)
        centroid = {"x": sx / len(points), "y": sy / len(points)}
        return {"bbox": [min_x, min_y, max_x, max_y], "centroid": centroid}

    def contains_point(self, x, y):
        """
        Ray-casting point-in-polygon (even-odd rule).
        Expects polygon as list of dicts [{x, y}, ...].
        """
        pts = self.coordinates or []
        if not pts:
            return False
        # quick bbox check
        if self.bbox:
            minX, minY, maxX, maxY = self.bbox
            if x < minX or x > maxX or y < minY or y > maxY:
                return False
        inside = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]["x"], pts[i]["y"]
            xj, yj = pts[j]["x"], pts[j]["y"]
            intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) if (yj - yi) != 0 else 1e-12) + xi)
            if intersect:
                inside = not inside
            j = i
        return inside

# CRUD helpers (use these from your controllers/views)
def create_zone(points, floorplan_id=None, name=None):
    meta = Zone.compute_meta(points)
    z = Zone(
        floorplan_id=floorplan_id,
        name=name,
        coordinates=points,
        bbox=meta["bbox"],
        centroid=meta["centroid"]
    )
    db.session.add(z)
    db.session.commit()
    return z.serialize()

def update_zone(zone_id, points=None, name=None, floorplan_id=None):
    z = Zone.query.get(zone_id)
    if not z:
        return None
    if points is not None:
        meta = Zone.compute_meta(points)
        z.coordinates = points
        z.bbox = meta["bbox"]
        z.centroid = meta["centroid"]
    if name is not None:
        z.name = name
    if floorplan_id is not None:
        z.floorplan_id = floorplan_id
    db.session.commit()
    return z.serialize()

def delete_zone(zone_id):
    z = Zone.query.get(zone_id)
    if not z:
        return False
    db.session.delete(z)
    db.session.commit()
    return True

def get_zones_for_floorplan(floorplan_id):
    qs = Zone.query.filter_by(floorplan_id=floorplan_id).order_by(Zone.id).all()
    return [z.serialize() for z in qs]