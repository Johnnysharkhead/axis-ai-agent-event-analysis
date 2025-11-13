#!/usr/bin/env python3
"""
MQTT client for Axis Q1656 camera scene metadata.
Receives person detections with geographic coordinates and radar distance.
"""
import json
import threading
import os
import time
import paho.mqtt.client as mqtt

# START  ----------
import json
import re

# STOP ----------

# In-memory store for API access
events = []

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

    try:
        payload = json.loads(msg.payload.decode())
    except:
        payload = msg.payload.decode()

    # START Added By delber You could remove this -------------------------
    if is_fusion_topic(msg.topic):
        handle_fusion_message(msg.topic, payload)

    # (keep your existing storage + person-processing logic)
    event = {"topic": msg.topic, "payload": payload}
    events.append(event)
    if len(events) > 200:
        events.pop(0)
    # STOP ----------------------------------------------------------
    # Store event for API access
    event = {"topic": msg.topic, "payload": payload}
    events.append(event)

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

    # Limit event history
    if len(events) > 200:
        events.pop(0)


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

  

def start_mqtt():

    broker_host = os.getenv("MQTT_BROKER_HOST", "localhost")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", 1883))

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[MQTT] Connecting to {broker_host}:{broker_port}...")
    client.connect(broker_host, broker_port, 60)
    thread = threading.Thread(target=client.loop_forever, daemon=True)
    thread.start()
    print("[MQTT] Background thread started\n")

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
