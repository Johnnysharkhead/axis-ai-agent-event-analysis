#!/usr/bin/env python3
from flask import Flask, Response, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

# import requests
import os
from livestream import VideoCamera
from video_saver import recording_manager
from mqtt_client import start_mqtt, get_events
import time

import models
from hls_handler import *
import authentication as auth2

app = Flask(__name__)

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

db = SQLAlchemy(app)

with app.app_context():
    User = models.init_models(db)  
    auth2.init_auth(app, db, User)  
    db.create_all()
    print(f"✓ Database initialized at: {db_path}")


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

    # fetch the camera instance from the pre-created dictionary
    cam = cameras.get(camera_id)
    if cam is None:
        return jsonify({"error": "Failed to retrieve camera instance"}), 500

    # no active-camera switching here — all cameras stream continuously

    return Response(
        generate_frames(camera_id), mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/events", methods=["GET", "OPTIONS"])
def events():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return jsonify(get_events())

@app.route("/users", methods=["GET", "OPTIONS"])
def get_users():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200


@app.route("/opencv_status")
def opencv_status():
    """Check if OpenCV is available for recording."""
    if cv2 is None:
        return jsonify({
            "available": False,
            "message": "OpenCV not found. Please install opencv-python."
        })

    return jsonify({
        "available": True,
        "version": cv2.__version__,
        "message": "OpenCV is ready for recording"
    })

@app.route("/video_info/<path:filename>")
def video_info(filename):
    """Get information about a specific video file."""
    recordings_dir = RECORDINGS_DIR
    video_path = os.path.join(recordings_dir, filename)
    
    if not os.path.exists(video_path):
        return jsonify({"error": VIDEO_NOT_FOUND_MESSAGE}), 404

    if filename.endswith(HLS_PLAYLIST_EXTENSION):
        return jsonify(extract_hls_metadata(video_path, filename))

    try:
        metadata = extract_standard_video_metadata(video_path, filename)
        return jsonify(metadata)
    except Exception as e:
        return jsonify({
            "filename": filename,
            "error": f"Error analyzing video: {str(e)}"
        })

@app.route("/recording/start", methods=["POST", "OPTIONS"])
def start_recording_route():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    # The RTSP URL is now sourced from the camera object on the backend
    rtsp_url = cameras[1].url  # Assuming we always record from camera 1 for simplicity
    output_dir = RECORDINGS_DIR
    success, message = recording_manager.start_recording(rtsp_url, output_dir)

    if success:
        return jsonify({"message": f"Recording started: {message}"})
    else:
        return jsonify({"error": message}), 400

@app.route("/recording/stop", methods=["POST", "OPTIONS"])
def stop_recording_route():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    success, message = recording_manager.stop_recording()

    if success:
        return jsonify({"message": f"Recording stopped: {message}"})
    else:
        return jsonify({"error": message}), 400

@app.route("/recording/status", methods=["GET", "OPTIONS"])
def recording_status_route():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    return jsonify({"is_recording": recording_manager.is_recording()})

@app.route("/videos", methods=["GET", "OPTIONS"])
def list_videos():
    print("In list videos")
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    print("First check")
    recordings_dir = RECORDINGS_DIR
    os.makedirs(recordings_dir, exist_ok=True)
    print("Andra check")
    
    try:
        print("tests")
        entries = collect_hls_playlists(recordings_dir)
        entries.extend(collect_legacy_recordings(recordings_dir))
        entries.sort(key=lambda item: item[1], reverse=True)
        return jsonify([name for name, _ in entries])
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/videos/<path:filename>", methods=["GET", "OPTIONS"])
def serve_video(filename):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    recordings_dir = RECORDINGS_DIR
    response = send_from_directory(recordings_dir, filename)
    lower_name = filename.lower()
    if lower_name.endswith(HLS_PLAYLIST_EXTENSION):
        response.headers["Content-Type"] = "application/vnd.apple.mpegurl"
    elif lower_name.endswith(HLS_SEGMENT_EXTENSION):
        response.headers["Content-Type"] = "video/mp2t"
    return response


@app.route("/videos/<path:filename>/stream")
def stream_recorded_video(filename):
    """Stream a saved video as MJPEG so browsers can play regardless of codec."""
    recordings_dir = RECORDINGS_DIR
    video_path = os.path.join(recordings_dir, filename)

    if not os.path.exists(video_path):
        return jsonify({"error": VIDEO_NOT_FOUND_MESSAGE}), 404

    if filename.lower().endswith(HLS_PLAYLIST_EXTENSION):
        return jsonify({"error": "MJPEG stream is not available for HLS playlists."}), 400

    if cv2 is None:
        return jsonify({"error": "OpenCV not available on the server"}), 500

    assert cv2 is not None  # Satisfy static analysis
    opencv = cv2

    cap = opencv.VideoCapture(video_path)
    if not cap.isOpened():
        return jsonify({"error": "Failed to open video"}), 500

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_delay = 1.0 / float(fps) if fps and fps > 0 else 1.0 / 25.0

    def generate():
        try:
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    break

                success, buffer = opencv.imencode('.jpg', frame, [opencv.IMWRITE_JPEG_QUALITY, 85])
                if not success:
                    continue

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

                time.sleep(frame_delay)
        finally:
            cap.release()

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')




# Active-camera / priority API removed — all cameras stream at full time.


if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # creates tables if they don’t exist
    app.run(host="0.0.0.0", port=backend_port)
