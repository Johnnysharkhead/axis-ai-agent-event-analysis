from flask import Blueprint
import os
import shutil
from flask import send_from_directory, jsonify, request, Response
#from main import cameras, app, _build_cors_preflight_response,RECORDINGS_DIR
from infrastructure.video_saver import recording_manager
from application.hls_handler import HLS_PLAYLIST_EXTENSION, HLS_SEGMENT_EXTENSION
import time
import cv2
from infrastructure.livestream import VideoCamera
# from backend_extensions import db
from domain.models import db, Recording, Snapshot
from datetime import datetime

recording_bp = Blueprint('recording', __name__) #, url_prefix='/recording')

# Define constants
# RECORDINGS_DIR = os.getenv(
#     "RECORDINGS_DIR",
#     os.path.abspath(os.path.join(os.path.dirname(__file__), "recordings")),
# )
# os.makedirs(RECORDINGS_DIR, exist_ok=True)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))  # one level up
RECORDINGS_DIR = os.getenv("RECORDINGS_DIR", os.path.join(BASE_DIR, "recordings"))
os.makedirs(RECORDINGS_DIR, exist_ok=True)

VIDEO_NOT_FOUND_MESSAGE = "Video file not found"

# Define cameras
cameras = {
    1: VideoCamera(os.getenv("CAMERA1_IP", "192.168.0.97")),
    2: VideoCamera(os.getenv("CAMERA2_IP", "192.168.0.98")),
    3: VideoCamera(os.getenv("CAMERA3_IP", "192.168.0.96"))
}

def _normalize_rel_path(recordings_dir: str, root: str, file: str) -> str:
    """Return a POSIX-style relative path from the recordings directory."""
    rel_root = os.path.relpath(root, recordings_dir)
    relative_name = os.path.join(rel_root, file) if rel_root != "." else file
    return relative_name.replace("\\", "/")

def collect_hls_playlists_in_subdir(subdir_path: str):
    """
    Collect valid HLS playlist files (.m3u8) in a single subdirectory (no recursion).

     Returns:
         List of tuples: (relative_path, mtime)
    """
    
    entries = []

    if not os.path.exists(subdir_path):
        return entries

    for file in os.listdir(subdir_path):
        if not file.endswith(HLS_PLAYLIST_EXTENSION):
            continue

        playlist_path = os.path.join(subdir_path, file)
        try:
            file_size = os.path.getsize(playlist_path)
        except OSError:
            continue

        if file_size <= 0:
            continue

        mtime = os.path.getmtime(playlist_path)
        # Optional: relative path relative to subdir
        rel_path = os.path.relpath(playlist_path, subdir_path)
        entries.append((rel_path, mtime))

    return entries

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
@recording_bp.route("/opencv_status")
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

@recording_bp.route("/video_info/<path:filename>")
def video_info(filename):
    """Get information about a specific video file."""
    video_path = os.path.join(RECORDINGS_DIR, filename)
    
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

@recording_bp.route("/recording/start", methods=["POST", "OPTIONS"])
def start_recording_route():
    """
    Method for starting a recording and to store it in the database and the local file system.

    For more information about how a Recording object is constructed, view backend/models/recording.py.
    """
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

    success, message = recording_manager.start_recording(timestamp, rtsp_url, output_dir)
    if success:
        return jsonify({"message": f"Recording started (camera {camera_id}): {message}"})
    else:
        return jsonify({"error": message}), 400    


@recording_bp.route("/recording/stop", methods=["POST", "OPTIONS"])
def stop_recording_route():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    success, message = recording_manager.stop_recording()

    if success:
        return jsonify({"message": f"Recording stopped: {message}"})
    else:
        return jsonify({"error": message}), 400

@recording_bp.route("/recording/status", methods=["GET", "OPTIONS"])
def recording_status_route():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    return jsonify({"is_recording": recording_manager.is_recording()})

@recording_bp.route("/videos", methods=["GET", "OPTIONS"])
def list_videos():
    """
    Method primarily for sending recording videos & data to Frontend.
    This route is called in frontend/src/pages/RecordingLibrary.js

    Update: Method also returns recording objects of database.
    Configured so that if database is configured as shared/global later, method only returns 
    db entries that the user also has in his/her filesystem.
    Currently not used in frontend but could have future implications.
    
    """
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    os.makedirs(RECORDINGS_DIR, exist_ok=True)

    recordings = Recording.query.all()

    valid_recordings = [
        rec for rec in recordings
        if os.path.exists(rec.url)
    ]
    
    try:
        entries = _collect_hls_playlists(RECORDINGS_DIR)
        entries.extend(_collect_legacy_recordings(RECORDINGS_DIR))
        entries.sort(key=lambda item: item[1], reverse=True)
        
        return jsonify({
            "db_entries" : [rec.serialize() for rec in valid_recordings],
            "recordings" : [name for name, _ in entries]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recording_bp.route("/videos/<path:filename>", methods=["GET", "OPTIONS"])
def serve_video(filename):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    response = send_from_directory(RECORDINGS_DIR, filename)
    lower_name = filename.lower()
    if lower_name.endswith(HLS_PLAYLIST_EXTENSION):
        response.headers["Content-Type"] = "application/vnd.apple.mpegurl"
    elif lower_name.endswith(HLS_SEGMENT_EXTENSION):
        response.headers["Content-Type"] = "video/mp2t"
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add("Access-Control-Allow-Credentials", "true")
    return response


@recording_bp.route("/videos/<path:filename>/stream")
def stream_recorded_video(filename):
    """Stream a saved video as MJPEG so browsers can play regardless of codec."""
    video_path = os.path.join(RECORDINGS_DIR, filename)

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

def _build_cors_preflight_response():
    """Handle CORS preflight OPTIONS requests"""
    response = jsonify({"message": "CORS preflight"})
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS")
    return response


@recording_bp.route("/recordings", methods=["DELETE", "OPTIONS"])
def delete_recording():
    """
    Delete a recording by recording_id.
    Automatically removes:
    - Recording database entry
    - All associated snapshots (database + files)
    - Recording folder with all video segments
    """
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    data = request.get_json()
    print("DELETE /recordings payload:", data)

    recording_id = data.get("recording_id")

    if not recording_id:
        return jsonify({"error": "recording_id must be provided"}), 400

    try:
        # Find the recording in the database
        recording = Recording.query.get(recording_id)
        if not recording:
            return jsonify({"error": f"Recording {recording_id} not found"}), 404

        print(f"DEBUG: Deleting recording {recording_id}")
        print(f"DEBUG: Recording URL: '{recording.url}'")

        deleted_items = {
            "recording_id": recording_id,
            "recording_folder": None,
            "snapshots_deleted": 0
        }

        # Step 1: Extract folder name from recording URL
        # The URL is stored as absolute path: "/app/recordings/recording_YYYYMMDD_
        if recording.url.startswith(RECORDINGS_DIR):
            # Extract just the folder name (e.g., "recording_20251127_132645")
            folder_name = os.path.basename(recording.url.rstrip("/"))
        else:
            # Fallback: assume URL is already just the folder name
            folder_name = recording.url.split("/")[-1]

        print(f"DEBUG: Extracted folder_name: '{folder_name}'")

        # Step 2: Validate folder name
        if not folder_name or not folder_name.startswith("recording_"):
            print(f"ERROR: Invalid folder name '{folder_name}'")
            # Continue with database cleanup even if folder is invalid
            folder_name = None

        # Step 3: Delete snapshot files from filesystem
        # Use the snapshots relationship instead of snapshot_paths
        if hasattr(recording, 'snapshots') and recording.snapshots:
            for snapshot in recording.snapshots:
                # snapshot.url contains the path to the snapshot file
                if snapshot.url:
                    snapshot_path = os.path.join(RECORDINGS_DIR, snapshot.url)
                    if os.path.exists(snapshot_path):
                        try:
                            os.remove(snapshot_path)
                            deleted_items["snapshots_deleted"] += 1
                            print(f"DEBUG: Deleted snapshot: {snapshot.url}")
                        except OSError as e:
                            print(f"WARNING: Could not delete snapshot {snapshot_path}: {e}")

        # Step 4: Delete recording folder from filesystem
        if folder_name:
            recording_folder = os.path.join(RECORDINGS_DIR, folder_name)
            recording_folder_abs = os.path.abspath(recording_folder)
            recordings_dir_abs = os.path.abspath(RECORDINGS_DIR)

            print(f"DEBUG: Recording folder to delete: {recording_folder_abs}")
            print(f"DEBUG: Recordings directory: {recordings_dir_abs}")

            # Safety checks
            if recording_folder_abs == recordings_dir_abs:
                print(f"ERROR: Attempted to delete root recordings directory - BLOCKED")
                return jsonify({"error": "Cannot delete root recordings directory"}), 400

            # Verify it's actually inside RECORDINGS_DIR
            if not recording_folder_abs.startswith(recordings_dir_abs + os.sep):
                print(f"ERROR: Folder is not inside recordings directory - BLOCKED")
                return jsonify({"error": "Invalid recording path"}), 400

            # Delete the folder
            if os.path.exists(recording_folder_abs) and os.path.isdir(recording_folder_abs):
                try:
                    contents = os.listdir(recording_folder_abs)
                    print(f"DEBUG: Deleting folder with {len(contents)} items: {recording_folder_abs}")
                    shutil.rmtree(recording_folder_abs)
                    deleted_items["recording_folder"] = folder_name
                    print(f"SUCCESS: Deleted folder {folder_name}")
                except PermissionError as pe:
                    print(f"ERROR: Permission denied: {pe}")
                    return jsonify({"error": f"Permission denied: {str(pe)}"}), 500
                except OSError as e:
                    print(f"ERROR: Failed to delete folder: {e}")
                    return jsonify({"error": f"Failed to delete folder: {str(e)}"}), 500
            else:
                print(f"WARNING: Recording folder does not exist: {recording_folder_abs}")

        # Step 5: Delete from database (cascades to snapshots and metadata)
        db.session.delete(recording)
        db.session.commit()
        print(f"SUCCESS: Deleted recording {recording_id} from database")

        return jsonify({
            "message": "Recording deleted successfully",
            "details": deleted_items
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Exception during deletion: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to delete recording: {str(e)}"}), 500
