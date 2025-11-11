import json
import threading
import os
import time
import datetime
import subprocess
import socket
import paho.mqtt.client as mqtt


shared_cameras = {}
events = []
EVENT_DIR = os.getenv("EVENT_DIR", "events")
COOLDOWN_SECONDS = int(os.getenv("COOLDOWN_SECONDS", 10))
last_trigger_time = {}


CAMERA_MAP = {
    "B8A44F9EED3B": 1,
    "B8A44F9EED3C": 2,
    "B8A44F9EED3D": 3
}


def log_event(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")

def register_cameras(cameras_dict):
    global shared_cameras
    shared_cameras = cameras_dict
    log_event(f"[Camera] Registered {len(shared_cameras)} cameras.")


def capture_snapshot(camera_id, timestamp):
    try:
        os.makedirs(EVENT_DIR, exist_ok=True)
        snapshot_path = os.path.join(EVENT_DIR, f"snap_{camera_id}_{timestamp}.jpg")

        cam = shared_cameras.get(camera_id)
        if cam:
            rtsp_url = cam.url
            cmd = [
                "ffmpeg", "-rtsp_transport", "tcp",
                "-i", rtsp_url,
                "-vframes", "1", "-q:v", "2",
                snapshot_path, "-y"
            ]
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            log_event(f"[Snapshot] Captured via ffmpeg (fallback) → {snapshot_path}")
            return snapshot_path

        log_event(f"[Snapshot] No camera found for ID {camera_id}")
        return None
    except Exception as e:
        log_event(f"[Snapshot] Error: {e}")
        return None

def record_event_clip(camera_id, timestamp):

    try:
        os.makedirs(EVENT_DIR, exist_ok=True)
        cam = shared_cameras.get(camera_id)
        if not cam:
            log_event(f"[Record] No shared camera for ID {camera_id}")
            return None

        rtsp_url = cam.url  
        clip_path = os.path.join(EVENT_DIR, f"clip_{camera_id}_{timestamp}.mp4")

        cmd = [
            "ffmpeg", "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-t", "10",
            "-vcodec", "copy", "-acodec", "copy",
            clip_path, "-y"
        ]
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log_event(f"[Record] Started async 10s clip for camera {camera_id} → {clip_path}")
        return clip_path
    except Exception as e:
        log_event(f"[Record] Error: {e}")
        return None


def handle_intrusion_event(topic, payload):
    """处理入侵事件"""
    try:
        os.makedirs(EVENT_DIR, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


        serial = topic.split("/")[1]
        camera_id = CAMERA_MAP.get(serial, serial)  

        event_data = {
            "camera_id": camera_id,
            "serial": serial,
            "timestamp": timestamp,
            "topic": topic,
            "payload": payload,
        }

 
        threading.Thread(target=capture_snapshot, args=(camera_id, timestamp), daemon=True).start()
        threading.Thread(target=record_event_clip, args=(camera_id, timestamp), daemon=True).start()

 
        json_path = os.path.join(EVENT_DIR, f"{camera_id}_{timestamp}.json")
        with open(json_path, "w") as f:
            json.dump(event_data, f, indent=4)
        log_event(f"[Intrusion] Event saved → {json_path}")

    except Exception as e:
        log_event(f"[Intrusion] Error: {e}")

def process_mqtt_event(topic, payload):

    try:
        serial = topic.split("/")[1]
        camera_id = CAMERA_MAP.get(serial, serial)


        active = None
        if isinstance(payload, dict):
            if "active" in payload:
                active = payload["active"]
            elif "message" in payload and "data" in payload["message"]:
                active = payload["message"]["data"].get("active")


        if str(active) in ["1", "true", "True"]:
            now = time.time()
            if now - last_trigger_time.get(camera_id, 0) >= COOLDOWN_SECONDS:
                last_trigger_time[camera_id] = now
                log_event(f"[Event] Motion detected → {camera_id}")
                threading.Thread(target=handle_intrusion_event, args=(topic, payload), daemon=True).start()
            else:
                log_event(f"[Event] Ignored (within cooldown) → {camera_id}")
        elif str(active) in ["0", "false", "False"]:
            log_event(f"[Event] Motion ended → {camera_id}")
        else:
            log_event(f"[Event] Ignored (no active field) → {camera_id}")

    except Exception as e:
        log_event(f"[Event] Error: {e}")


def on_connect(client, userdata, flags, rc):
    log_event(f"[MQTT] Connected callback triggered (code={rc})")
    subs = [("axis/+/event/#", 0)]
    result, mid = client.subscribe(subs)
    log_event(f"[MQTT] Subscribed to {subs} → result={result}, mid={mid}")


def on_message(client, userdata, msg):
    print(f"MQTT message arrived: {msg.topic}")
    try:
        payload = json.loads(msg.payload.decode())
    except Exception:
        payload = msg.payload.decode(errors="ignore")

    event = {"topic": msg.topic, "payload": payload}
    events.append(event)
    if len(events) > 200:
        events.pop(0)

    log_event(f"[MQTT] Received ({len(events)}) {msg.topic} → {str(payload)[:120]}")
    process_mqtt_event(msg.topic, payload)



def start_mqtt(debug=True):
    broker_host = os.getenv("MQTT_BROKER_HOST", "host.docker.internal")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", 1883))

    client = mqtt.Client()
    if debug:
        client.enable_logger()
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
    log_event("[MQTT] Background thread started for real-time loop")
    return client


def get_events():
    return events[-50:] 