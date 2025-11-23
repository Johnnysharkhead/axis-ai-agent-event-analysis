from . import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import func, Time, Boolean
from sqlalchemy.orm import joinedload

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

    # relationship to schedules
    schedules = db.relationship(
        "ZoneSchedule",
        backref="zone",
        cascade="all, delete-orphan",
        lazy="select"
    )

    def serialize(self):
        return {
            "id": int(self.id) if self.id is not None else None,
            "floorplan_id": int(self.floorplan_id) if self.floorplan_id is not None else None,
            "name": self.name,
            "points": self.coordinates,
            "bbox": list(self.bbox) if self.bbox is not None else None,
            "centroid": self.centroid,
            "schedules": [s.serialize() for s in getattr(self, "schedules", [])],
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

# ZoneSchedule model
class ZoneSchedule(db.Model):
    __tablename__ = "zone_schedules"

    id = db.Column(db.BigInteger, primary_key=True)
    zone_id = db.Column(db.BigInteger, db.ForeignKey("zones.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(db.String(16), nullable=False)           # 'recurring' | 'one-time'
    # store selected days as JSON array for portability across DB backends
    days = db.Column(db.JSON, nullable=True)                  # JSON array of day codes, e.g. ["Mon","Tue"]
    start_time = db.Column(Time, nullable=True)               # for recurring: "HH:MM:SS"
    end_time = db.Column(Time, nullable=True)
    spans_next_day = db.Column(Boolean, default=False)
    start_dt = db.Column(db.DateTime(timezone=True), nullable=True)  # for one-time
    end_dt = db.Column(db.DateTime(timezone=True), nullable=True)
    enabled = db.Column(Boolean, default=True)
    alarm_mode = db.Column(db.String(32), nullable=True)

    def serialize(self):
        return {
            "id": int(self.id) if self.id is not None else None,
            "zone_id": int(self.zone_id) if self.zone_id is not None else None,
            "type": self.type,
            "days": list(self.days) if self.days is not None else [],
            # time fields returned as strings that the frontend expects ("HH:MM" for time, ISO for datetimes)
            "start": self.start_time.isoformat() if self.start_time else None,
            "end": self.end_time.isoformat() if self.end_time else None,
            "spansNextDay": bool(self.spans_next_day),
            "startDateTime": self.start_dt.isoformat() if self.start_dt else None,
            "endDateTime": self.end_dt.isoformat() if self.end_dt else None,
            "enabled": bool(self.enabled),
            "alarmMode": self.alarm_mode,
        }
 
# CRUD helpers for zones and schedules
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
    # eager-load schedules to avoid N+1 queries
    qs = Zone.query.options(joinedload(Zone.schedules)).filter_by(floorplan_id=floorplan_id).order_by(Zone.id).all()
    return [z.serialize() for z in qs]

# Schedule helpers
def create_schedule(zone_id, payload):
    s = ZoneSchedule(
        zone_id=zone_id,
        type=payload.get("type", "recurring"),
        days=payload.get("days"),
        start_time=payload.get("start"),
        end_time=payload.get("end"),
        spans_next_day=bool(payload.get("spansNextDay", False)),
        start_dt=payload.get("startDateTime"),
        end_dt=payload.get("endDateTime"),
        enabled=payload.get("enabled", True),
        alarm_mode=payload.get("alarmMode"),
        # meta removed
    )
    db.session.add(s)
    db.session.commit()
    return s.serialize()

def update_schedule(schedule_id, payload):
    s = ZoneSchedule.query.get(schedule_id)
    if not s:
        return None
    if "type" in payload: s.type = payload["type"]
    if "days" in payload: s.days = payload["days"]
    if "start" in payload: s.start_time = payload["start"]
    if "end" in payload: s.end_time = payload["end"]
    if "spansNextDay" in payload: s.spans_next_day = bool(payload["spansNextDay"])
    if "startDateTime" in payload: s.start_dt = payload["startDateTime"]
    if "endDateTime" in payload: s.end_dt = payload["endDateTime"]
    if "enabled" in payload: s.enabled = bool(payload["enabled"])
    if "alarmMode" in payload: s.alarm_mode = payload["alarmMode"]
    db.session.commit()
    return s.serialize()

def delete_schedule(schedule_id):
    s = ZoneSchedule.query.get(schedule_id)
    if not s:
        return False
    db.session.delete(s)
    db.session.commit()
    return True

def get_schedules_for_zone(zone_id):
    qs = ZoneSchedule.query.filter_by(zone_id=zone_id).order_by(ZoneSchedule.id).all()
    return [s.serialize() for s in qs]