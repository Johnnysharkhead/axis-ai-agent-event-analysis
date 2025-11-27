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
from domain.models import Camera, Floorplan, Zone
from infrastructure.floorplan_handler import FloorplanManager
from infrastructure import alarm_control

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
    
    
# =========================================================
# Point-in-polygon (EXACT same logic as frontend)
# =========================================================
def point_in_polygon(pt, poly):
    """
    pt: {"x": float, "y": float}
    poly: [{"x": float, "y": float}, ...]
    """
    inside = False
    for i in range(len(poly)):
        j = (i - 1) % len(poly)
        xi, yi = poly[i]["x"], poly[i]["y"]
        xj, yj = poly[j]["x"], poly[j]["y"]
        intersect = (yi > pt["y"]) != (yj > pt["y"]) and \
            pt["x"] < (xj - xi) * (pt["y"] - yi) / ((yj - yi) + 1e-9) + xi
        if intersect:
            inside = not inside
    return inside


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


# =========================================================
# Main intrusion trigger (MQTT)
# =========================================================
def trigger_intrusion(topic, payload):
    """Classic intrusion trigger used by MQTT-based events."""
    try:
        serial = topic.split("/")[1]
        camera = Camera.query.filter_by(serialno=serial).first()
        camera_id = camera.id if camera else None

        now = time.time()
        if camera_id and now - last_trigger_time.get(camera_id, 0) < COOLDOWN_SECONDS:
            log(f"[Intrusion] Ignored (cooldown) → camera {camera_id}")
            return False

        if camera_id:
            last_trigger_time[camera_id] = now

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

        # Snapshot + clip in parallel
        threading.Thread(target=capture_snapshot, args=(camera_id, timestamp), daemon=True).start()
        threading.Thread(target=record_event_clip, args=(camera_id, timestamp), daemon=True).start()
        
        # Use a simpler integer ID if possible, or ensure schema supports BigInt
        # Truncating or hashing might be safer if this ID is too large for standard SQL Integer
        if camera_id is not None:
            recording_id_int = int(f"{camera_id}{timestamp}")
        else:
          recording_id_int = None
        
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

        event_path = save_event_json(camera_id, timestamp, event_data)

        snapshot_path = f"{EVENT_DIR}/snap_{camera_id}_{timestamp}.jpg"
        clip_path = f"{EVENT_DIR}/clip_{camera_id}_{timestamp}.mp4"

        threading.Thread(target=capture_snapshot, args=(camera_id, timestamp), daemon=True).start()
        threading.Thread(target=record_event_clip, args=(camera_id, timestamp), daemon=True).start()

        # Trigger alarm loop when intrusion is detected
        alarm_control.start_loop()

        log(f"[Intrusion] Triggered → camera {camera_id}")
        return True

    except Exception as e:
        log(f"[Intrusion] Error: {e}")
        return False


# =========================================================
# Zone-based intrusion trigger (recommended)
# =========================================================
def trigger_zone_intrusion(camera_id, zone_name, zone_id, track_id, object_xy):
    """Unified entry for floorplan-zone intrusion events."""
    topic = f"zone_intrusion/{camera_id}/{zone_id}"
    payload = {
        "source": "zone",
        "zone_name": zone_name,
        "zone_id": zone_id,
        "track_id": track_id,
        "object_xy": object_xy,
    }
    return trigger_intrusion(topic, payload)


# =========================================================
# Zone-based intrusion processing (called by mqtt_client)
# =========================================================
def process_fusion_for_intrusion(payload):
    """
    This function:
    - Extracts camera serial, track_id, lat/lon
    - Converts to floorplan coordinates
    - Loads all zones of the floorplan
    - Uses point-in-polygon to detect intrusion
    - Calls trigger_zone_intrusion()
    """
    # Extract fields
    serial = (
        payload.get("device", {}).get("serialNo")
        or payload.get("camera_serial")
        or payload.get("serial")
    )
    track_id = payload.get("track_id")
    lat = payload.get("latitude") or payload.get("lat")
    lon = payload.get("longitude") or payload.get("lon")

    if serial is None or lat is None or lon is None:
        return False

    # Locate camera
    camera = Camera.query.filter_by(serialno=serial).first()
    if not camera or not camera.floorplan:
        return False

    floorplan = camera.floorplan

    # Convert coordinates
    bottom_left = floorplan.corner_geocoordinates.get("bottom_left")
    try:
        xy = FloorplanManager.calculate_position_on_floorplan(
            object_lat=float(lat),
            object_lon=float(lon),
            bottom_left_coords=bottom_left,
        )
        x_m, y_m = xy["x_m"], xy["y_m"]
    except Exception:
        return False

    pt = {"x": x_m, "y": y_m}

    # Check zones
    zones = Zone.query.filter_by(floorplan_id=floorplan.id).all()
    for zone in zones:
        try:
            poly = json.loads(zone.coordinates)
        except Exception:
            continue

        if point_in_polygon(pt, poly):
            trigger_zone_intrusion(
                camera_id=camera.id,
                zone_name=zone.name,
                zone_id=zone.id,
                track_id=track_id,
                object_xy=pt,
            )
            return True

    return False
    
    
    
    
    # [intrusion]-cameraIDtimestamp
    # strore the name of the zone that triggered the intrusion
    # alarm signal 

