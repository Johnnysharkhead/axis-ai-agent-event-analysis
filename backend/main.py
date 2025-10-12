#!/usr/bin/env python3
from flask import Flask, Response, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

# import requests
import os
from livestream import VideoCamera
from mqtt_client import start_mqtt, get_events
import time

import models
import authentication as auth2
from flask_login import LoginManager, login_required, current_user



app = Flask(__name__)
#Setup loginmanager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Add a secret key and sane cookie settings for localhost
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
    REMEMBER_COOKIE_SAMESITE="Lax",
    REMEMBER_COOKIE_SECURE=False,
)

try:
    mqtt_client = start_mqtt()
except TimeoutError:
    mqtt_client = None
    app.logger.warning("MQTT broker unreachable; continuing without MQTT")

# CORS setup for API calls between front- and backend
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)


def _build_cors_preflight_response():
    response = jsonify({"message": "CORS preflight"})
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")

    response.headers.add(
        "Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS"
    )

    return response


# Ensure instance/ folder exists
os.makedirs(app.instance_path, exist_ok=True)

# Use variable from .env for port (default 5001)
backend_port = int(os.getenv("BACKEND_PORT", 5001))

# Configure SQLite database inside instance/
db_path = os.path.join(app.instance_path, "database.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

with app.app_context():
    User, InviteKey = models.init_models(db) 
    auth2.init_auth(app, db, User, InviteKey)  
    db.create_all()
    #Remove below in prod
    raw_key, key_hash = InviteKey.generate_key()
    invite = InviteKey(key_hash=key_hash)
    db.session.add(invite)
    db.session.commit()
    print(f"✓ Test invite key: {raw_key}")
    ####Remove above in prod
    print(f"✓ Database initialized at: {db_path}")


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized"}), 401

#get user from database
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


cameras = {
    1: VideoCamera(os.getenv("CAMERA1_IP", "192.168.0.97")),
    2: VideoCamera(os.getenv("CAMERA2_IP", "192.168.0.98")),
    3: VideoCamera(os.getenv("CAMERA3_IP", "192.168.0.96"))
}


def generate_frames(camera_id):
    """Generate frames for the video stream with simpler timing"""
    camera = cameras.get(camera_id)
    if camera is None:
        return None

    while True:
        # Simple approach: Get frame, yield it, minimal sleep
        frame = camera.get_frame()
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            
            # Small fixed sleep to prevent CPU overuse
            time.sleep(0.01)  # 10ms sleep
        else:
            # No frame available, wait a bit longer
            time.sleep(0.1)
            continue

# Example route
@app.route("/test", methods=["GET", "OPTIONS"])
def index():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    print("Test")
    response = jsonify({"message": "Hello from Flask with an auto-created DB!"})
    return response


# Base API call for video feed
@app.route("/video_feed/<int:camera_id>", methods=["GET", "OPTIONS"])
def video_feed(camera_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if camera_id not in cameras:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    set_active_camera(camera_id)

    return Response(
        generate_frames(camera_id), mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/events", methods=["GET", "OPTIONS"])
def events():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return jsonify(get_events())

@app.route("/users", methods=["GET", "OPTIONS"])
@login_required
def get_users():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200



# Set initial priorities - make camera 1 primary by default
def set_active_camera(camera_id):
    """Set which camera gets priority treatment"""
    for cam_id, camera in cameras.items():
        camera.set_priority(cam_id == camera_id)

# Set camera 1 as the initial primary camera
set_active_camera(1)

# Add a new route to change the active camera
@app.route("/set_active_camera/<int:camera_id>", methods=["POST"])
def activate_camera(camera_id):
    if camera_id not in cameras:
        return jsonify({"success": False, "error": "Camera not found"}), 404
    
    set_active_camera(camera_id)
    return jsonify({"success": True, "active_camera": camera_id})


if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # creates tables if they don’t exist
    app.run(host="0.0.0.0", port=backend_port)
