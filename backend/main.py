#!/usr/bin/env python3
from flask import Flask, Response, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
# from backend_extensions import app, db

# import requests
import os
from livestream import VideoCamera
from video_saver import recording_manager
from mqtt_client import start_mqtt, get_events
import time

from datetime import datetime
from models import db
from hls_handler import *
import authentication as auth2
from flask_login import LoginManager, login_required, current_user

from routes.video_routes import video_bp
#from authentication import auth_bp
from routes.recording_routes import recording_bp



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

# Register blueprints
app.register_blueprint(video_bp)
#app.register_blueprint(auth_bp)
app.register_blueprint(recording_bp)

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

# Directory for recordings
VIDEO_NOT_FOUND_MESSAGE = "Video file not found"
HLS_PLAYLIST_EXTENSION = ".m3u8"
HLS_SEGMENT_EXTENSION = ".ts"
RECORDINGS_DIR = os.getenv(
 "RECORDINGS_DIR",
 os.path.abspath(os.path.join(os.path.dirname(__file__), "recordings")),
)
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# Use variable from .env for port (default 5001)
backend_port = int(os.getenv("BACKEND_PORT", 5001))

# Configure SQLite database inside instance/
db_path = os.path.join(app.instance_path, "database.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# db = SQLAlchemy(app)

with app.app_context():
    """
    User, InviteKey, Room, Camera, Recording, Metadata = models.init_models(db) 
    User, InviteKey = models.init_user_models(db)
    Room = models.get_room_model(db)
    Camera = models.get_camera_model(db)
    Recording = models.get_recording_model(db)
    Metadata = models.get_metadata_model(db)
    """
    from models import User, InviteKey, Room, Camera, Recording, Metadata

    auth2.init_auth(app, db, User, InviteKey)  
    # db.drop_all()  # <- This clears the local database (uncomment this the first time or if invitation key does not work)
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

# Example route
@app.route("/test", methods=["GET", "OPTIONS"])
def index():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    print("Test")
    response = jsonify({"message": "Hello from Flask with an auto-created DB!"})
    return response

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


if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # creates tables if they don’t exist
    app.run(host="0.0.0.0", port=backend_port)
