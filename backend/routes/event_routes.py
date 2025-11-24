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
        # Ensure this fits your DB schema for recording_id
        rec_id = int(f"{camera_id}{timestamp_str}")

        # Create Recording entry
        # Note: Using 'start_time' based on your previous error logs
        recording = Recording(
            recording_id=rec_id,
            url=clip_path,
            start_time=dt,
            end_time=dt + datetime.timedelta(seconds=10) # Default 10s duration
        )
        
        db.session.add(recording)
        
        # Optional: Create Snapshot entry if you have a separate table
        # snapshot = Snapshot(recording_id=rec_id, url=snapshot_path)
        # db.session.add(snapshot)

        db.session.commit()
        
        return jsonify({"message": "Event saved successfully", "id": rec_id}), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


