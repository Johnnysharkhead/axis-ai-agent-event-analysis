from . import db
from datetime import datetime

class Zone(db.Model):
    """
    Class for storing Zone data in the database.
    A Zone represents a specific area with defined coordinates.
    """
    __tablename__ = "zones"

    id = db.Column(db.Integer, primary_key=True)
    coordinates = db.Column(db.String(255), nullable=False)  # Store coordinates as a string (e.g., JSON or WKT)

    def serialize(self):
        """
        Convert the Zone object into a dictionary for JSON serialization.
        """
        return {
            "id": self.id,
            "coordinates": self.coordinates
        }

    """
    These following def's are examples of how to interact with the
    Zone class
    """
def create_zone(x, y):
    zone = Zone(x_coordinate=x, y_coordinate=y)
    db.session.add(zone)
    db.session.commit()
    return zone.serialize()

def update_zone(zone_id, x, y):
    zone = Zone.query.get(zone_id)
    if zone:
        zone.x_coordinate = x
        zone.y_coordinate = y
        db.session.commit()
        return zone.serialize()
    return {"error": "Zone not found"}

def delete_zone(zone_id):
    zone = Zone.query.get(zone_id)
    if zone:
        db.session.delete(zone)
        db.session.commit()
        return {"message": "Zone deleted"}
    return {"error": "Zone not found"}


class AlarmSchedule(db.Model):
    """
    Class for storing alarm schedules for a zone.
    Each schedule contains a list of start and end times when the alarm is active.
    """
    __tablename__ = "alarm_schedules"

    id = db.Column(db.Integer, primary_key=True)
    zone_id = db.Column(db.Integer, db.ForeignKey("zones.id"), nullable=False)
    start_time = db.Column(db.Integer, nullable=False)  # Full integer value for time (e.g., 800 for 08:00)
    end_time = db.Column(db.Integer, nullable=False)    # Full integer value for time (e.g., 1700 for 17:00)

    def serialize(self):
        """
        Convert the AlarmSchedule object into a dictionary for JSON serialization.
        """
        return {
            "id": self.id,
            "zone_id": self.zone_id,
            "start_time": self.start_time,
            "end_time": self.end_time
        }

    """
    These following def's are examples of how to interact with the
    AlarmSchedule class
    """
def create_alarm_schedule(zone_id, start_time, end_time):
    schedule = AlarmSchedule(zone_id=zone_id, start_time=start_time, end_time=end_time)
    db.session.add(schedule)
    db.session.commit()
    return schedule.serialize()

def update_alarm_schedule(schedule_id, start_time, end_time):
    schedule = AlarmSchedule.query.get(schedule_id)
    if schedule:
        schedule.start_time = start_time
        schedule.end_time = end_time
        db.session.commit()
        return schedule.serialize()
    return {"error": "AlarmSchedule not found"}

def delete_alarm_schedule(schedule_id):
    schedule = AlarmSchedule.query.get(schedule_id)
    if schedule:
        db.session.delete(schedule)
        db.session.commit()
        return {"message": "AlarmSchedule deleted"}
    return {"error": "AlarmSchedule not found"}

def is_alarm_active(zone_id, current_time):
    zone = Zone.query.get(zone_id)
    if zone:
        return zone.check_alarm(current_time)
    return {"error": "Zone not found"}