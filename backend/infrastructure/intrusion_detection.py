# intrusion_detection.py
"""
Intrusion Detection module.
This version DOES NOT depend on the database or main.py camera registration.
Camera URLs are hard-coded below and always available.
Now ALSO saves events, recordings, snapshots and metadata to the database.
"""

# ========== IMPORTS ==========
# Corrected imports for Docker environment (where /app is root)
import os
import json
import time
import threading
import datetime
import subprocess
import requests  # <--- Ensure requests is imported

# REMOVED: Database imports to avoid context errors
# from domain.models import db...

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

        # Snapshot + clip in parallel
        threading.Thread(target=capture_snapshot, args=(camera_id, timestamp), daemon=True).start()
        threading.Thread(target=record_event_clip, args=(camera_id, timestamp), daemon=True).start()
        
        # Use a simpler integer ID if possible, or ensure schema supports BigInt
        # Truncating or hashing might be safer if this ID is too large for standard SQL Integer
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
        
        # --- Save to db via Internal Route ---
        try:
            # Fixed: Use /internal/create since blueprint has no url_prefix
            api_url = "http://localhost:5001/internal/create"
            
            payload_data = {
                "camera_id": camera_id,
                "timestamp": timestamp,
                "clip_path": clip_path,
                "snapshot_path": snapshot_path
            }
            
            # Send with timeout so we don't block the intrusion logic
            requests.post(api_url, json=payload_data, timeout=2)
            log(f"[API] Sent event to DB: {api_url}")

        except Exception as api_e:
            log(f"[API] Warning: Failed to send event to DB: {api_e}")

        # Snapshot + clip in parallel
        threading.Thread(target=capture_snapshot, args=(camera_id, timestamp), daemon=True).start()
        threading.Thread(target=record_event_clip, args=(camera_id, timestamp), daemon=True).start()

        log(f"[Intrusion] Triggered → camera {camera_id}")
        return True

    except Exception as e:
        log(f"[Intrusion] Error: {e}")
        return False