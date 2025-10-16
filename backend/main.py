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

from datetime import datetime
import models
from hls_handler import *
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
    User, InviteKey, Room, Camera, Recording, Metadata = models.init_models(db) 
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


def _normalize_rel_path(recordings_dir: str, root: str, file: str) -> str:
    """Return a POSIX-style relative path from the recordings directory."""
    rel_root = os.path.relpath(root, recordings_dir)
    relative_name = os.path.join(rel_root, file) if rel_root != "." else file
    return relative_name.replace("\\", "/")


def _collect_hls_playlists(recordings_dir: str):
    entries = []
    for root, _, files in os.walk(recordings_dir):
        for file in files:
            if not file.endswith(HLS_PLAYLIST_EXTENSION):
                continue

            playlist_path = os.path.join(root, file)
            try:
                file_size = os.path.getsize(playlist_path)
            except OSError:
                continue

            if file_size <= 0:
                continue

            mtime = os.path.getmtime(playlist_path)
            rel_path = _normalize_rel_path(recordings_dir, root, file)
            entries.append((rel_path, mtime))
    return entries


def _collect_legacy_recordings(recordings_dir: str):
    entries = []
    for filename in os.listdir(recordings_dir):
        if not filename.endswith((".mp4", ".avi", ".webm")):
            continue

        file_path = os.path.join(recordings_dir, filename)
        try:
            file_size = os.path.getsize(file_path)
        except OSError:
            continue

        if file_size <= 1024:
            print(f"Skipping {filename} - file too small ({file_size} bytes)")
            continue

        mtime = os.path.getmtime(file_path)
        entries.append((filename, mtime))
    return entries


def _playlist_size_bytes(playlist_path: str) -> int:
    try:
        return os.path.getsize(playlist_path)
    except OSError:
        return 0


def _segment_stats(playlist_dir: str):
    total_size = 0
    segment_count = 0
    try:
        for entry in os.scandir(playlist_dir):
            if entry.is_file() and entry.name.endswith(HLS_SEGMENT_EXTENSION):
                try:
                    total_size += entry.stat().st_size
                    segment_count += 1
                except OSError:
                    continue
    except FileNotFoundError:
        pass
    return segment_count, total_size


def _playlist_duration_seconds(playlist_path: str) -> float:
    duration = 0.0
    try:
        with open(playlist_path, "r", encoding="utf-8") as playlist_file:
            for line in playlist_file:
                line = line.strip()
                if not line.startswith("#EXTINF:"):
                    continue
                try:
                    duration += float(line.split(":", 1)[1].split(",", 1)[0])
                except (ValueError, IndexError):
                    continue
    except (OSError, UnicodeDecodeError):
        return 0.0
    return duration


def _extract_hls_metadata(video_path: str, filename: str):
    playlist_dir = os.path.dirname(video_path)
    playlist_size = _playlist_size_bytes(video_path)
    segment_count, segments_size = _segment_stats(playlist_dir)
    total_size = playlist_size + segments_size
    duration = _playlist_duration_seconds(video_path)

    return {
        "filename": filename,
        "file_size": total_size,
        "playlist_size": playlist_size,
        "segment_count": segment_count,
        "duration_seconds": duration,
        "playable": True,
        "format": "hls",
    }


def _extract_standard_video_metadata(video_path: str, filename: str):
    if cv2 is None:
        return {
            "filename": filename,
            "file_size": os.path.getsize(video_path),
            "error": "OpenCV not available for video analysis",
        }

    file_size = os.path.getsize(video_path)
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        return {
            "filename": filename,
            "file_size": file_size,
            "error": "Could not open video file with OpenCV",
        }

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0
    cap.release()

    return {
        "filename": filename,
        "file_size": file_size,
        "resolution": f"{width}x{height}",
        "fps": fps,
        "frame_count": frame_count,
        "duration_seconds": duration,
        "playable": True,
    }



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
@login_required
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
        return jsonify(_extract_hls_metadata(video_path, filename))

    try:
        metadata = _extract_standard_video_metadata(video_path, filename)
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
    
    payload = request.get_json(silent=True) or {}
    camera_id = payload.get("camera_id") or request.args.get("camera_id") or 1
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    rec_id = int(str(camera_id) + (timestamp.split('_')[0]) + timestamp.split('_')[1])
    recording_folder = f"recording_{timestamp}"
    recording_url = os.path.join(RECORDINGS_DIR, recording_folder)

    new_recording = Recording(
        recording_id = rec_id,
        url = recording_url,
    )

    db.session.add(new_recording)
    db.session.commit()
    
    try:
        camera_id = int(camera_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid camera_id"}), 400

    cam = cameras.get(camera_id)
    if not cam:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    rtsp_url = cam.url
    output_dir = RECORDINGS_DIR




    success, message = recording_manager.start_recording(rtsp_url, output_dir)
    

    if success:
        return jsonify({"message": f"Recording started (camera {camera_id}): {message}"})
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
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    recordings_dir = RECORDINGS_DIR
    os.makedirs(recordings_dir, exist_ok=True)
    
    recordings = Recording.query.all()

    try:
        entries = _collect_hls_playlists(recordings_dir)
        entries.extend(_collect_legacy_recordings(recordings_dir))
        entries.sort(key=lambda item: item[1], reverse=True)

        return jsonify([rec.serialize() for rec in recordings],
               [name for name, _ in entries])
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
