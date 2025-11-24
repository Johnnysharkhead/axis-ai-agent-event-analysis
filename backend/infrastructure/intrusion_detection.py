# intrusion_detection.py
"""
Intrusion Detection module.
This version DOES NOT depend on the database or main.py camera registration.
Camera URLs are hard-coded below and always available.
Now ALSO saves events, recordings, snapshots and metadata to the database.
"""

import os
import json
import time
import threading
import datetime
import subprocess
from domain.models import db
from domain.models.recording import Recording, Snapshot, EventLog

# ========== CONFIG ==========
EVENT_DIR = os.getenv("EVENT_DIR", "events")
COOLDOWN_SECONDS = int(os.getenv("COOLDOWN_SECONDS", 10))

# Map Axis serial numbers → camera numeric ID
CAMERA_MAP = {
    "B8A44F9EED3B": 1,
    "B8A44F9EED3C": 2,
    "B8A44F9EED3D": 3,
}

# ========== CAMERA URLs (hard-coded) ==========
USERNAME = os.getenv("camera_login", "student")
PASSWORD = os.getenv("camera_password", "student")

# IMPORTANT: Hard-coded mapping of camera_id → RTSP URL
shared_cameras = {
    1: f"rtsp://{USERNAME}:{PASSWORD}@192.168.0.97/axis-media/media.amp",

    # Add more cameras if needed:
    # 2: f"rtsp://{USERNAME}:{PASSWORD}@192.168.0.98/axis-media/media.amp",
    # 3: f"rtsp://{USERNAME}:{PASSWORD}@192.168.0.96/axis-media/media.amp",
}

# runtime state
last_trigger_time = {}

# ========== LOGGING ==========
def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")

# ================================
# Find intrusion zone
# to be used when saving EventLog to DB later on
# ================================


# ================================
# Snapshot capture
# ================================
def capture_snapshot(camera_id, timestamp):
    try:
        os.makedirs(EVENT_DIR, exist_ok=True)
        snapshot_path = f"{EVENT_DIR}/snap_{camera_id}_{timestamp}.jpg"

        cam_url = shared_cameras.get(camera_id)
        if not cam_url:
            log(f"[Snapshot] No camera found for ID {camera_id}")
            return None

        cmd = [
            "ffmpeg",
            "-rtsp_transport", "tcp",
            "-i", cam_url,
            "-vframes", "1",
            "-q:v", "2",
            snapshot_path,
            "-y",
        ]

        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log(f"[Snapshot] Saved → {snapshot_path}")
        return snapshot_path

    except Exception as e:
        log(f"[Snapshot] Error: {e}")
        return None


# ================================
# Clip recording
# ================================
def record_event_clip(camera_id, timestamp):
    try:
        os.makedirs(EVENT_DIR, exist_ok=True)

        cam_url = shared_cameras.get(camera_id)
        if not cam_url:
            log(f"[Clip] No camera found for ID {camera_id}")
            return None

        clip_path = f"{EVENT_DIR}/clip_{camera_id}_{timestamp}.mp4"

        cmd = [
            "ffmpeg",
            "-rtsp_transport", "tcp",
            "-i", cam_url,
            "-t", "10",               # record 10 seconds
            "-vcodec", "copy",
            "-acodec", "copy",
            clip_path,
            "-y",
        ]

        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log(f"[Clip] Recording started → {clip_path}")
        return clip_path

    except Exception as e:
        log(f"[Clip] Error: {e}")
        return None


# ================================
# Save event JSON
# ================================
def save_event_json(camera_id, timestamp, event_data):
    os.makedirs(EVENT_DIR, exist_ok=True)
    json_path = f"{EVENT_DIR}/{camera_id}_{timestamp}.json"

    with open(json_path, "w") as f:
        json.dump(event_data, f, indent=4)

    log(f"[JSON] Saved → {json_path}")
    return json_path


# ================================
# Main public entry point
# ================================
def trigger_intrusion(topic, payload):
    """
    Called by mqtt_client when intrusion should occur.
    Hard-coded camera URLs ensure we always find the camera.
    """
    try:
        serial = topic.split("/")[1]           # extract Axis serial number
        camera_id = CAMERA_MAP.get(serial, serial)

        now = time.time()
        if now - last_trigger_time.get(camera_id, 0) < COOLDOWN_SECONDS:
            log(f"[Intrusion] Ignored (cooldown) → camera {camera_id}")
            return False

        last_trigger_time[camera_id] = now

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

        # Find the zone for this intrusion "zone_id = getZone()" something like that
        # TO DO: This requires that we have a way to link intrusion to zones.
    

        # Snapshot + clip in parallel
        threading.Thread(target=capture_snapshot, args=(camera_id, timestamp), daemon=True).start()
        threading.Thread(target=record_event_clip, args=(camera_id, timestamp), daemon=True).start()
        
        recording_id_int = int(f"{camera_id}{timestamp}")
        
        # Paths for clip & snapshot
        clip_path = f"{EVENT_DIR}/clip_{camera_id}_{timestamp}.mp4"
        snapshot_path = f"{EVENT_DIR}/snap_{camera_id}_{timestamp}.jpg"
        event_data = {
            "camera_id": camera_id,
            "serial": serial,
            "timestamp": timestamp,
            "topic": topic,
            "payload": payload,
        }

        save_event_json(camera_id, timestamp, event_data)
        
        # --- Save to db ---
        recording = Recording(
            recording_id=recording_id_int,
            url=clip_path, )
        db.session.add(recording)

        snapshot_row = Snapshot(
            recording=recording,
            url=snapshot_path, )
        db.session.add(snapshot_row)

         # TO DO: set correct zone_id when available
        event_log = EventLog(zone_id=None) 
        db.session.add(event_log)

        event_log.recordings.append(recording)

        db.session.commit()

        log(f"[Intrusion] Triggered → camera {camera_id}")
        return True

    except Exception as e:
        log(f"[Intrusion] Error: {e}")
        db.session.rollback()
        return False