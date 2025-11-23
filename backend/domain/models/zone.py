from . import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import func

class Zone(db.Model):
    """Zone model storing polygon coordinates; bbox stored as PostgreSQL float8[]"""
    __tablename__ = "zones"

    id = db.Column(db.BigInteger, primary_key=True)
    floorplan_id = db.Column(db.BigInteger, nullable=False)
    name = db.Column(db.String(128), nullable=False)
    coordinates = db.Column(db.JSON, nullable=False)       # jsonb column for points
    bbox = db.Column(ARRAY(db.Float), nullable=False)       # float8[] in DB
    centroid = db.Column(db.JSON, nullable=True)            # jsonb
    # timestamps removed per schema — handled elsewhere if needed

    def serialize(self):
        return {
            "id": int(self.id) if self.id is not None else None,
            "floorplan_id": int(self.floorplan_id) if self.floorplan_id is not None else None,
            "name": self.name,
            "points": self.coordinates,
            "bbox": list(self.bbox) if self.bbox is not None else None,
            "centroid": self.centroid,
            # timestamps intentionally omitted
        }

    @staticmethod
    def compute_meta(points):
        if not points:
            return {"bbox": [0.0, 0.0, 0.0, 0.0], "centroid": {"x": 0.0, "y": 0.0}}
        min_x = min(float(p["x"]) for p in points)
        min_y = min(float(p["y"]) for p in points)
        max_x = max(float(p["x"]) for p in points)
        max_y = max(float(p["y"]) for p in points)
        sx = sum(float(p["x"]) for p in points)
        sy = sum(float(p["y"]) for p in points)
        centroid = {"x": sx / len(points), "y": sy / len(points)}
        return {"bbox": [min_x, min_y, max_x, max_y], "centroid": centroid}

    def contains_point(self, x, y):
        pts = self.coordinates or []
        if not pts:
            return False
        if self.bbox:
            minX, minY, maxX, maxY = self.bbox
            if x < minX or x > maxX or y < minY or y > maxY:
                return False
        inside = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = float(pts[i]["x"]), float(pts[i]["y"])
            xj, yj = float(pts[j]["x"]), float(pts[j]["y"])
            intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) if (yj - yi) != 0 else 1e-12) + xi)
            if intersect:
                inside = not inside
            j = i
        return inside

# CRUD helpers
def create_zone(points, floorplan_id=None, name=None):
    meta = Zone.compute_meta(points)
    z = Zone(
        floorplan_id=floorplan_id,
        name=name or "Zone",
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