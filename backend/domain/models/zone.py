from . import db
from datetime import datetime
from sqlalchemy import func, Time, Boolean, and_, or_, TypeDecorator, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import joinedload
import traceback

class PortableFloatArray(TypeDecorator):
    """Array type that uses PostgreSQL ARRAY in production, JSON in SQLite for testing"""
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(ARRAY(db.Float))
        else:
            return dialect.type_descriptor(JSON())

class Zone(db.Model):
    """Zone model storing polygon coordinates; bbox uses ARRAY in PostgreSQL, JSON in SQLite"""
    __tablename__ = "zones"

    id = db.Column(db.BigInteger, primary_key=True)
    #floorplan_id = db.Column(db.BigInteger, nullable=False)
    floorplan_id = db.Column(
    db.Integer,
    db.ForeignKey("floorplans.id", ondelete="CASCADE"),
    nullable=False
    )
    name = db.Column(db.String(128), nullable=False)
    coordinates = db.Column(db.JSON, nullable=False)       # jsonb column for points
    bbox = db.Column(PortableFloatArray, nullable=False)   # ARRAY in PostgreSQL, JSON in SQLite
    centroid = db.Column(db.JSON, nullable=True)            # jsonb
    # timestamps removed per schema — handled elsewhere if needed

    # relationship to schedules
    schedules = db.relationship(
        "ZoneSchedule",
        backref="zone",
        cascade="all, delete-orphan",
        lazy="select"
    )

    floorplan = db.relationship("Floorplan", back_populates="zones")

    #Relationship to EventLog
    event_logs = db.relationship("EventLog", back_populates="zone", cascade="all, delete-orphan")

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
    # allow NULL for one-time schedules (null means "not applicable")
    spans_next_day = db.Column(Boolean, nullable=True, default=None)
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
            # preserve NULL for one-time schedules; otherwise boolean
            "spansNextDay": None if self.spans_next_day is None else bool(self.spans_next_day),
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
    # determine spans_next_day only for recurring schedules; one-time -> None
    schedule_type = payload.get("type", "recurring")
    spans_val = None
    if schedule_type == "recurring":
        spans_val = bool(payload.get("spansNextDay", False))
    s = ZoneSchedule(
        zone_id=zone_id,
        type=schedule_type,
        days=payload.get("days"),
        start_time=payload.get("start"),
        end_time=payload.get("end"),
        spans_next_day=spans_val,
        start_dt=payload.get("startDateTime"),
        end_dt=payload.get("endDateTime"),
        enabled=payload.get("enabled", True),
        alarm_mode=payload.get("alarmMode"),
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
    # if client supplies spansNextDay explicitly -> set accordingly;
    # if schedule type is changed to one-time and client didn't supply spansNextDay -> set to NULL
    if "spansNextDay" in payload:
        s.spans_next_day = bool(payload["spansNextDay"])
    elif "type" in payload and payload["type"] == "one-time":
        s.spans_next_day = None
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


def get_current_active_schedules(floorplan_id):
    try:
        now = datetime.now()
        current_time = now.time()
        weekday = now.strftime("%a")

        all_zone_schedules_for_floorplan = (
            ZoneSchedule.query
            .join(Zone)
            .filter(Zone.floorplan_id == floorplan_id)
        )

        # Use JSON containment operator instead of contains()
        weekday_filter = ZoneSchedule.days.op("@>")([weekday])

        recurring = and_(
            ZoneSchedule.type == "recurring",
            weekday_filter,
            or_(
                # normal same-day schedules
                and_(
                    ZoneSchedule.spans_next_day.is_(False),
                    ZoneSchedule.start_time <= current_time,
                    ZoneSchedule.end_time >= current_time,
                ),
                # schedules that span past midnight
                and_(
                    ZoneSchedule.spans_next_day.is_(True),
                    or_(
                        ZoneSchedule.start_time <= current_time,
                        ZoneSchedule.end_time >= current_time,
                    ),
                ),
            ),
        )

        one_time = and_(
            ZoneSchedule.type == "one-time",
            ZoneSchedule.start_dt <= now,
            ZoneSchedule.end_dt >= now,
        )

        active = (
            all_zone_schedules_for_floorplan
            .filter(or_(recurring, one_time))
            .all()
        )

        inactive = (
            all_zone_schedules_for_floorplan
            .filter(~or_(recurring, one_time))
            .all()
        )

        return active, inactive

    except Exception as e:
        traceback.print_exc()
