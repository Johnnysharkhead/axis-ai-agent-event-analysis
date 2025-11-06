#!/usr/bin/env python3
"""
Backend Application Entry Point
Main Flask application with layered architecture
"""
from flask import Flask, Response, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import LoginManager, login_required, current_user
import os

app = Flask(__name__)

# Setup loginmanager
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

# CORS setup for API calls between front- and backend
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

def _build_cors_preflight_response():
    response = jsonify({"message": "CORS preflight"})
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS")
    return response

# Ensure instance/ folder exists
os.makedirs(app.instance_path, exist_ok=True)

# Configure SQLite database inside instance/
db_path = os.path.join(app.instance_path, "database.db")
# app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize database
from backend.domain.models import db
db.init_app(app)
migrate = Migrate(app, db)

# Register blueprints
from backend.api.video_routes import video_bp
from backend.api.recording_routes import recording_bp
from backend.api.snapshot_routes import snapshot_bp
app.register_blueprint(video_bp)
app.register_blueprint(recording_bp)
app.register_blueprint(snapshot_bp)

# Initialize MQTT (optional)
try:
    from backend.infrastructure.mqtt_client import start_mqtt, get_events
    mqtt_client = start_mqtt()
except TimeoutError:
    mqtt_client = None
    app.logger.warning("MQTT broker unreachable; continuing without MQTT")

# Use variable from .env for port (default 5001)
backend_port = int(os.getenv("BACKEND_PORT", 5001))

with app.app_context():
    from backend.domain.models import User, InviteKey, Room, Camera, Recording, Metadata
    
    # Initialize authentication
    import backend.api.auth_routes as auth2
    auth2.init_auth(app, db, User, InviteKey)
    
    # db.drop_all()  # <- Uncomment to reset database
    db.create_all()
    
    # Create test invite key (remove in production)
    raw_key, key_hash = InviteKey.generate_key()
    invite = InviteKey(key_hash=key_hash)
    db.session.add(invite)
    db.session.commit()
    print(f"✓ Test invite key: {raw_key}")
    print(f"✓ Database initialized at: {db_path}")

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized"}), 401

@login_manager.user_loader
def load_user(user_id):
    from backend.domain.models import User
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
    from backend.infrastructure.mqtt_client import get_events
    return jsonify(get_events())

@app.route("/users", methods=["GET", "OPTIONS"])
@login_required
def get_users():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    from backend.domain.models import User
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # creates tables if they don't exist
    app.run(host="0.0.0.0", port=backend_port)

