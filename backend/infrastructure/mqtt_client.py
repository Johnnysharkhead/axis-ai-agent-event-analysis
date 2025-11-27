#!/usr/bin/env python3
"""
MQTT client for Axis Q1656 camera scene metadata.
Receives person detections with geographic coordinates and radar distance.
"""
import json
from multiprocessing.util import debug
import subprocess
import threading
import os
import time
import datetime
import subprocess
import paho.mqtt.client as mqtt
from infrastructure.fusion_persistence import is_fusion_topic, store_fusion_message
from infrastructure.intrusion_detection import trigger_intrusion, process_fusion_for_intrusion

# START  ----------
import json
import re

# STOP ----------

# In-memory store for API access
events = []
EVENT_DIR = os.getenv("EVENT_DIR", "events")    # the directory to store events, snapshots, and clips, with a default of "events"
COOLDOWN_SECONDS = int(os.getenv("COOLDOWN_SECONDS", 10))   # cooldown period between processing events from the same camera
last_trigger_time = {}
_flask_app = None
CAMERA_MAP = {"B8A44F9EED3B": 1, "E8272505477E": 2, "B8A44F9EEE36": 3}



def log_event(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")


def _set_flask_app(flask_app):
    global _flask_app
    _flask_app = flask_app


def register_cameras(cameras_dict):
    global shared_cameras
    shared_cameras = cameras_dict
    log_event(f"[Camera] Registered {len(shared_cameras)} cameras.")


ignore_log_time = {}
IGNORE_LOG_INTERVAL = 5  # seconds


# def process_mqtt_event(topic, payload):
#     """
#     Intrusion detection trigger logic with log-rate limiting:
#     - Trigger intrusion when observations exist
#     - Ignore cooldown spam (print at most once every IGNORE_LOG_INTERVAL seconds)
#     """
#     try:
#         serial = topic.split("/")[1]
#         camera_id = CAMERA_MAP.get(serial, serial)

#         frame = payload.get("frame") if isinstance(payload, dict) else None

#         if frame is not None:
#             observations = frame.get("observations", [])

#             if observations:

#                 now = time.time()

#                 # cooldown OK → trigger
#                 if now - last_trigger_time.get(camera_id, 0) >= COOLDOWN_SECONDS:
#                     last_trigger_time[camera_id] = now

#                     log_event(f"[Intrusion-Trigger] Observations detected → {camera_id}")

#                     threading.Thread(
#                         target=trigger_intrusion,
#                         args=(topic, payload),
#                         daemon=True
#                     ).start()

#                 else:
#                     # ★ suppression of repeated cooldown logs ★
#                     last_log = ignore_log_time.get(camera_id, 0)
#                     if now - last_log >= IGNORE_LOG_INTERVAL:
#                         log_event(f"[Intrusion] Ignored due to cooldown → {camera_id}")
#                         ignore_log_time[camera_id] = now

#             else:
#                 log_event(f"[Event] No observations → {camera_id}")

#         else:
#             log_event(f"[Event] Non-frame MQTT message → {camera_id}")

#     except Exception as e:
#         log_event(f"[Event] Error: {e}")

# Rate limiting: Print detections every 2 seconds per person
last_print_time = {}
PRINT_INTERVAL = 2.0  # seconds


def on_connect(client, userdata, flags, rc):
    # Handle MQTT connection
    print(f"\n{'='*60}")
    print(f"[MQTT] Connected to broker (code: {rc})")
    print(f"{'='*60}\n")

    # Subscribe to Axis Scene Metadata topics
    client.subscribe("com.axis.analytics_scene_description.v0.beta")
    client.subscribe("axis/+/analytics/scene/#")
    client.subscribe("axis/+/analytics/fusion/#")
    client.subscribe("axis/+/scene/metadata")

    print("[MQTT] Subscribed to Axis Scene Metadata topics")
    print("  - axis/+/analytics/fusion (Fusion Analytics)")
    print()


def on_message(client, userdata, msg):
    # log_event(f"[DEBUG] MQTT Payload: {msg.payload.decode()}")

    try:
        payload = json.loads(msg.payload.decode())
    except:
        payload = msg.payload.decode()

    if is_fusion_topic(msg.topic):
        log_event(f"[Fusion] Topic: {msg.topic}")
        store_fusion_message(msg.topic, payload, flask_app=_flask_app, log_fn=log_event)
        


    event = {"topic": msg.topic, "payload": payload}
    events.append(event)
    if len(events) > 200:
        events.pop(0)

    # Store event for API access
    event = {"topic": msg.topic, "payload": payload}
    events.append(event)
    
    process_fusion_for_intrusion(payload)

#------------------------START: Can be removed /Victor --------------------------
    # Process scene metadata
    if isinstance(payload, dict):
        if "frame" in payload and "observations" in payload.get("frame", {}):
            observations = payload["frame"]["observations"]

            for obs in observations:
                # Only process humans
                obj_class = obs.get("class", {})
                obj_type = obj_class.get("type", "")

                if obj_type in ["Human", "Person", "person", "human"]:
                    process_person_detection(obs, msg.topic)

#------------------------END: Can be removed /Victor --------------------------


    # Limit event history
    if len(events) > 200:
        events.pop(0)

#------------------------START: Can be removed /Victor --------------------------
def process_person_detection(obs, topic):
    """Process and print person detection."""
    track_id = obs.get("track_id", "unknown")
    confidence = obs.get("class", {}).get("score", 0)

    # Rate limiting: Print every 2 seconds per track
    current_time = time.time()
    if track_id in last_print_time:
        if current_time - last_print_time[track_id] < PRINT_INTERVAL:
            return  # Skip - printed too recently

    last_print_time[track_id] = current_time

    # Extract camera ID from topic
    camera_id = None
    topic_parts = topic.split("/")
    if len(topic_parts) >= 2 and topic_parts[0] == "axis":
        camera_id = topic_parts[1]

   

    # Get geographic coordinates (from camera's built-in geolocation)
    geo_coords = (
        obs.get("geoposition")
        or obs.get("geographical_coordinate")
        or obs.get("position")
        or obs.get("geolocation")
        or obs.get("geoposition")
    )

    # Get spherical coordinates (from camera's built-in radar)
    spherical = obs.get("spherical_coordinate", {})

#------------------------END: Can be removed /Victor --------------------------

def start_mqtt(flask_app=None, debug=True):
    _set_flask_app(flask_app)
    broker_host = os.getenv("MQTT_BROKER_HOST", "localhost")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", 1883))

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message


    def connect_and_loop():
        while True:
            try:
                log_event(f"[MQTT] Connecting to {broker_host}:{broker_port} ...")
                client.connect(broker_host, broker_port, 60)
                log_event(f"[MQTT] Connected to broker at {broker_host}:{broker_port}")
                client.loop_forever()
            except Exception as e:
                log_event(f"[MQTT] Connection error: {e}, retrying in 5s ...")
                time.sleep(5)
    threading.Thread(target=connect_and_loop, daemon=True).start()
    return client


def get_events():
    """Return recent MQTT events for API access."""
    return events[-50:]


# Added by Delber in case you want to remove this its fine
# Match: axis/<camera-id>/analytics/fusion (optionally with subpaths)
FUSION_TOPIC_RE = re.compile(r"^axis/([^/]+)/analytics/fusion(?:/.*)?$")


def is_fusion_topic(topic: str) -> bool:
    return bool(FUSION_TOPIC_RE.match(topic))


def handle_fusion_message(topic: str, payload):
    """
    Pretty-print everything the Fusion topic publishes,
    plus a compact summary of observations if present.
    """
    print("\n" + "=" * 80)
    print(f"[FUSION] topic = {topic}")

    # Raw dump (exactly what the camera sent)
    if isinstance(payload, (dict, list)):
        print(
            "[FUSION][RAW]\n"
            + json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False)
        )
    else:
        print("[FUSION][RAW]\n" + str(payload))
