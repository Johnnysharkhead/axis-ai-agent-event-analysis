import json
import threading
import os
import paho.mqtt.client as mqtt

# Simple in-memory store for now
events = []


def on_connect(client, userdata, flags, rc):
    print("Connected to broker with result code", rc)

    # Subscribe to motion events + scene metadata
    client.subscribe("axis/+/event/#")
    client.subscribe("site/cam01/scene/#")


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except:
        payload = msg.payload.decode()
    event = {"topic": msg.topic, "payload": payload}
    print("Event", event)
    events.append(event)

    if len(events) > 200:
        events.pop(0)


def start_mqtt():
    broker_host = os.getenv("MQTT_BROKER_HOST", "localhost")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", 1883))

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    # client.connect(broker_host, broker_port, 60)  # <-- Comment this out
    # thread = threading.Thread(target=client.loop_forever, daemon=True)
    # thread.start()
    return client


def get_events():
    # Return last events
    return events[-50:]
