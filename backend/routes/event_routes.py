from domain.models import db, Recording, Snapshot, Metadata, EventLog, Zone
import os
import datetime
from flask import Blueprint, request, jsonify
import traceback

event_bp = Blueprint('event', __name__)

@event_bp.route('/internal/create', methods=['POST'])
def create_event_internal():
    """
    Internal route called by the intrusion detection background thread.
    Receives event data and saves it to the database.
    Creates both Recording and EventLog entries.
    """
    try:
        data = request.json
        camera_id = data.get('camera_id')
        timestamp_str = data.get('timestamp')
        clip_path = data.get('clip_path')
        snapshot_path = data.get('snapshot_path')

        if not all([camera_id, timestamp_str, clip_path]):
            return jsonify({"error": "Missing required fields"}), 400

        # Parse timestamp (format: YYYYMMDDHHMMSS)
        dt = datetime.datetime.strptime(timestamp_str, "%Y%m%d%H%M%S")

        # Generate a unique ID (integer)
        rec_id = int(f"{camera_id}{timestamp_str}")

        # 1. Create Recording entry (only has recording_id and url)
        recording = Recording(
            recording_id=rec_id,
            url=clip_path
        )
        db.session.add(recording)
        
        # 2. Create Snapshot entry if snapshot_path exists
        if snapshot_path:
            snapshot = Snapshot(
                recording_id=rec_id,
                url=snapshot_path,
                timestamp=dt
            )
            db.session.add(snapshot)

        # 3. Create EventLog entry WITHOUT zone_id (to avoid the missing column error)
        event_log = EventLog()
        
        # 4. Link the recording to the event via the many-to-many relationship
        event_log.recordings.append(recording)
        
        db.session.add(event_log)
        db.session.commit()
        
        return jsonify({
            "message": "Event saved successfully",
            "recording_id": rec_id,
            "event_id": event_log.id
        }), 201

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    

@event_bp.route('/internal/events', methods=['GET'])
def get_events_internal():
    """
    Internal route to fetch all events with their recordings and snapshots.
    """
    try:
        events = EventLog.query.all()
        print(events)
        result = []
        for event in events:
            event_data = {
                "event_id": event.id,
                #"zone_id": event.zone_id,
                "recordings": [],
            }
            
        
        return jsonify(result), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


