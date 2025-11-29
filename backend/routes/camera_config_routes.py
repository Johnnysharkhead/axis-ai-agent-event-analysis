
###this file should be restructured into 2 different files, currently it handles routes for camera configs
### and the position stream and heatmap. Ill do it before the sprint 3 merge to main
###Split into camera-config_routes and position_routes 

#Camera Configuration Routes
#geolocation, orientation and restart
#Will test with cameras 12/11

import json
import os
import time
import requests
from requests.auth import HTTPDigestAuth, HTTPBasicAuth
from infrastructure.mqtt_client import get_events
from flask import Blueprint, request, jsonify, Response, stream_with_context, g
from flask_cors import CORS
from functools import wraps
from domain.models import Camera, PositionHistory, db
import traceback
from infrastructure.floorplan_handler import FloorplanManager
from infrastructure.track_fusion import TrackFusion
from infrastructure.position_processor import PositionProcessor
from datetime import datetime

camera_config_bp = Blueprint('camera_config', __name__)
CORS(camera_config_bp, origins=["http://localhost:3000"], supports_credentials=True)

# Camera configuration from environment
CAMERA_IPS = {
    1: os.getenv("CAMERA1_IP", "192.168.0.97"),
    2: os.getenv("CAMERA2_IP", "192.168.0.98"),
    3: os.getenv("CAMERA3_IP", "192.168.0.96")
}
CAMERA_USER = os.getenv("camera_login", "root")
CAMERA_PASS = os.getenv("camera_password", "pass")

# Initialize track fusion manager for multi-camera tracking
track_fusion = TrackFusion(fusion_distance=0.5, track_timeout=3.0)

# Initialize position processor service
position_processor = PositionProcessor(
    track_fusion=track_fusion,
    floorplan_manager=FloorplanManager,
    bottom_left_coord=[58.395908306412494, 15.577992051878446]
)

# Initialize track fusion manager for multi-camera tracking
track_fusion = TrackFusion(fusion_distance=0.5, track_timeout=3.0)

#------------------------CONFIGS FOR CAMERA--------------------------
def camera_request(url, timeout=10):
    try:
        response = requests.get(url, auth=HTTPBasicAuth(CAMERA_USER, CAMERA_PASS), timeout=timeout)
        if response.status_code == 401:
            response = requests.get(url, auth=HTTPDigestAuth(CAMERA_USER, CAMERA_PASS), timeout=timeout)
        return response, None
    except requests.exceptions.RequestException as e:
        return None, str(e)

#Helper, validate camera id
def validate_camera_id(f):
    @wraps(f)
    def decorated_function(camera_id, *args, **kwargs):
        if camera_id not in CAMERA_IPS:
            return jsonify({"error": f"Camera {camera_id} not found"}), 404
        g.camera_ip = CAMERA_IPS[camera_id]
        g.camera_id = camera_id
        return f(camera_id, *args, **kwargs)
    return decorated_function

#Helper
def make_camera_response(response, error, success_data=None):
    if error:
        return jsonify({"error": f"Connection error: {error}"}), 500

    if response.status_code == 200:
        result = {"success": True, "camera_id": g.camera_id}
        if success_data:
            result.update(success_data)
        result["response"] = response.text
        return jsonify(result), 200
    else:
        return jsonify({
            "error": "Request failed",
            "status_code": response.status_code,
            "response": response.text
        }), response.status_code

#Format cords to ISO 6709 so it works with axis cameras
def format_coordinate(value, is_longitude=False):
    val = float(value)

    # Format with max 9 decimals, remove trailing zeros
    formatted = f"{val:.9f}".rstrip('0').rstrip('.')

    # Split into integer and decimal parts
    if '.' in formatted:
        int_part, dec_part = formatted.split('.')
    else:
        int_part = formatted
        dec_part = None

    # Handle negative numbers
    is_negative = int_part.startswith('-')
    if is_negative:
        abs_int_part = int_part[1:]  # Remove minus sign temporarily
    else:
        abs_int_part = int_part

    # Pad integer part with leading zeros for ISO 6709
    if is_longitude:
        abs_int_part = abs_int_part.zfill(3)  # 3 digits for longitude
    else:
        abs_int_part = abs_int_part.zfill(2)  # 2 digits for latitude

    # Reconstruct with proper formatting
    if is_negative:
        int_part = '-' + abs_int_part
    else:
        int_part = abs_int_part

    if dec_part:
        return f"{int_part}.{dec_part}"
    else:
        return int_part

#Sets cameras geolocation
def set_geolocation(camera_ip, lat, lng):
    formatted_lat = format_coordinate(lat, is_longitude=False)
    formatted_lng = format_coordinate(lng, is_longitude=True)
    url = f"http://{camera_ip}/axis-cgi/geolocation/set.cgi?lat={formatted_lat}&lng={formatted_lng}"
    response, error = camera_request(url)
    return response, error, formatted_lat, formatted_lng

#Sets cameras orientation
def set_orientation(camera_ip, tilt, heading, inst_height, elevation=None):
    """Helper to set camera orientation"""
    url = f"http://{camera_ip}/axis-cgi/geoorientation/geoorientation.cgi?action=set&tilt={tilt}&heading={heading}&inst_height={inst_height}"
    if elevation is not None:
        url += f"&elevation={elevation}"
    response, error = camera_request(url)
    return response, error

#List cameras
@camera_config_bp.route("/cameras", methods=["GET", "OPTIONS"])
def cameras():
    """Get list of cameras from database"""
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    if request.method == "GET":
        try:
            # cameras = Camera.query.filter(Camera.floorplan_id == None).all()
            cameras = Camera.query.all()

            if cameras:
                return jsonify({"cameras": [camera.serialize() for camera in cameras]})
            return jsonify({"message": "no cameras in database"}), 200
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": "failed fetching cameras from db"}), 404

#Route to set ONLY camera geolocation by camera id, might be reduntant
@camera_config_bp.route("/cameras/<int:camera_id>/geolocation", methods=["POST", "OPTIONS"])
@validate_camera_id
def set_camera_geolocation(camera_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    data = request.get_json()
    lat = data.get("latitude")
    lng = data.get("longitude")

    if lat is None or lng is None:
        return jsonify({"error": "latitude and longitude are required"}), 400

    response, error, formatted_lat, formatted_lng = set_geolocation(g.camera_ip, lat, lng)

    return make_camera_response(response, error, {
        "latitude": formatted_lat,
        "longitude": formatted_lng
    })

#Route to set ONLY camera orientation by camera id, might be reduntant
@camera_config_bp.route("/cameras/<int:camera_id>/orientation", methods=["POST", "OPTIONS"])
@validate_camera_id
def set_camera_orientation(camera_id):
    """Set camera orientation (tilt, heading, elevation, installation height)"""
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    data = request.get_json()
    tilt = data.get("tilt")
    heading = data.get("heading")
    elevation = data.get("elevation")
    inst_height = data.get("installation_height")

    if tilt is None or heading is None or inst_height is None:
        return jsonify({"error": "tilt, heading, and installation_height are required"}), 400

    response, error = set_orientation(g.camera_ip, tilt, heading, inst_height, elevation)

    success_data = {
        "tilt": tilt,
        "heading": heading,
        "installation_height": inst_height
    }
    if elevation is not None:
        success_data["elevation"] = elevation

    return make_camera_response(response, error, success_data)

#ONLY restart cameras by ID, might be reduntant
@camera_config_bp.route("/cameras/<int:camera_id>/restart", methods=["POST", "OPTIONS"])
@validate_camera_id
def restart_camera(camera_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    url = f"http://{g.camera_ip}/axis-cgi/restart.cgi"
    response, error = camera_request(url)

    return make_camera_response(response, error, {
        "message": "Camera restart initiated"
    })

#This route is for setting geolocation, orientation and restarting
@camera_config_bp.route("/cameras/<int:camera_id>/configure", methods=["POST", "OPTIONS"])
@validate_camera_id
def configure_camera(camera_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    data = request.get_json()
    results = {"camera_id": camera_id, "steps": []}
    try:
        camera = Camera.query.filter_by(camera_id = camera_id).first()
    except Exception as e:
        return jsonify({'error' : 'camera not found in database'}), 500
    
    #Set Geolocation
    if "latitude" in data and "longitude" in data:
        response, error, formatted_lat, formatted_lng = set_geolocation(
            g.camera_ip, data["latitude"], data["longitude"]
        )
        camera.lat = data["latitude"]
        camera.lon = data["longitude"]
        if error:
            results["steps"].append({"step": "geolocation", "success": False, "error": error})
        else:
            results["steps"].append({
                "step": "geolocation",
                "success": response.status_code == 200,
                "latitude": formatted_lat,
                "longitude": formatted_lng
            })


    #Set Orientation
    if "tilt" in data and "heading" in data and "installation_height" in data:
        response, error = set_orientation(
            g.camera_ip,
            data["tilt"],
            data["heading"],
            data["installation_height"],
            data.get("elevation")
        )
        camera.tilt_deg = data["tilt"]
        camera.heading_deg = data["heading"]
        camera.height_m = data["installation_height"]

        if error:
            results["steps"].append({"step": "orientation", "success": False, "error": error})
        else:
            step_result = {
                "step": "orientation",
                "success": response.status_code == 200,
                "tilt": data["tilt"],
                "heading": data["heading"],
                "installation_height": data["installation_height"]
            }
            if data.get("elevation") is not None:
                step_result["elevation"] = data["elevation"]
            results["steps"].append(step_result)

    #Restart
    if data.get("restart", False):
        url = f"http://{g.camera_ip}/axis-cgi/restart.cgi"
        response, error = camera_request(url)

        if error:
            results["steps"].append({"step": "restart", "success": False, "error": error})
        else:
            results["steps"].append({
                "step": "restart",
                "success": response.status_code == 200,
                "message": "Camera restart initiated"
            })

    #Check success
    all_success = all(step.get("success", False) for step in results["steps"])
    results["success"] = all_success
    db.session.commit()
    return jsonify(results), 200 if all_success else 207

#Get current geolocation of camera
@camera_config_bp.route("/cameras/<int:camera_id>/geolocation", methods=["GET", "OPTIONS"])
@validate_camera_id
def get_camera_geolocation(camera_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    url = f"http://{g.camera_ip}/axis-cgi/geolocation/get.cgi"
    response, error = camera_request(url)

    return make_camera_response(response, error)

#Get current orientation of camera
@camera_config_bp.route("/cameras/<int:camera_id>/orientation", methods=["GET", "OPTIONS"])
@validate_camera_id
def get_camera_orientation(camera_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    url = f"http://{g.camera_ip}/axis-cgi/geoorientation/geoorientation.cgi?action=get"
    response, error = camera_request(url)

    return make_camera_response(response, error)

#------------------------FLOORMAP AND HEATMAP------------------

#Stream object geoposition with multi-camera fusion
@camera_config_bp.route('/stream/positions')
def stream_positions():
    # Stream real-time position data to frontend
    # Processes MQTT events and applies track fusion.

    def generate():
        last_sent = {}
        position_batch = []
        last_db_insert = time.time()
        BATCH_INSERT_INTERVAL = 5.0  #Insert to DB every 5 seconds

        while True:
            #Get events from MQTT client
            for event in get_events():
                # Process event into fused positions
                positions = position_processor.process_mqtt_event(event)

                #Stream each position update
                for position in positions:
                    track_id = position['track_id']

                    #Only send if position changed, deduplicate
                    if last_sent.get(track_id) != position:
                        yield f"data: {json.dumps(position)}\n\n"
                        last_sent[track_id] = position

                        #updated the heatmap in batches to save performance
                        position_batch.append({
                            'track_id': track_id,
                            'x_m': position['x_m'],
                            'y_m': position['y_m'],
                            'timestamp': datetime.utcnow()
                        })

            #Same here, updated db in batches every 5s
            current_time = time.time()
            if position_batch and (current_time - last_db_insert) >= BATCH_INSERT_INTERVAL:
                try:
                    db.session.bulk_insert_mappings(PositionHistory, position_batch)
                    db.session.commit()
                    position_batch.clear()
                    last_db_insert = current_time
                    print(f"[Stream] Saved batch of {len(position_batch)} positions to database for heatmap")
                except Exception as e:
                    db.session.rollback()
                    print(f"[Error] Failed to insert positions to DB: {e}")
                    position_batch.clear()

            time.sleep(0.5)


    return Response(stream_with_context(generate()),
                    mimetype='text/event-stream')

# Heatmap data endpoint
@camera_config_bp.route('/heatmap/data', methods=['GET'])
def get_heatmap_data():

    try:
        # Get query parameters
        duration = int(request.args.get('duration', 600))
        grid_size = int(request.args.get('grid_size', 50))
        floorplan_width = float(request.args.get('floorplan_width', 10.0))
        floorplan_height = float(request.args.get('floorplan_height', 10.0))

        from datetime import timedelta
        time_threshold = datetime.utcnow() - timedelta(seconds=duration)

        # Query positions from database within time window
        positions = PositionHistory.query.filter(
            PositionHistory.timestamp >= time_threshold
        ).all()

        # Initialize grid
        grid = [[0 for _ in range(grid_size)] for _ in range(grid_size)]
        cell_width = floorplan_width / grid_size
        cell_height = floorplan_height / grid_size

        # Aggregate positions into grid cells
        for pos in positions:
            # Calculate grid cell coordinates
            grid_x = int(pos.x_m / cell_width)
            grid_y = int(pos.y_m / cell_height)

            if 0 <= grid_x < grid_size and 0 <= grid_y < grid_size:
                grid[grid_y][grid_x] += 1

        # Normalize grid values to 0-1 range
        max_value = max(max(row) for row in grid) if any(any(row) for row in grid) else 1

        normalized_grid = [
            [cell / max_value if max_value > 0 else 0 for cell in row]
            for row in grid
        ]

        return jsonify({
            'success': True,
            'data': {
                'grid': normalized_grid,
                'grid_size': grid_size,
                'max_value': max_value,
                'total_positions': len(positions),
                'duration_seconds': duration,
                'floorplan_width': floorplan_width,
                'floorplan_height': floorplan_height
            }
        }), 200

    except Exception as e:
        print(f"[Error] Heatmap data error: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@camera_config_bp.route('/heatmap/clear', methods=['DELETE', 'OPTIONS'])
def clear_heatmap_history():
    """
    Clear position history from the database
    Optional query params:
    - older_than: Delete records older than X seconds (default: delete all)
    """
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    try:
        older_than = request.args.get('older_than', type=int)

        if older_than:
            # Delete records older than specified duration
            from datetime import timedelta
            time_threshold = datetime.utcnow() - timedelta(seconds=older_than)
            deleted_count = PositionHistory.query.filter(
                PositionHistory.timestamp < time_threshold
            ).delete()
        else:
            # Delete all records
            deleted_count = PositionHistory.query.delete()

        db.session.commit()

        print(f"[Heatmap] Cleared {deleted_count} position history records")

        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} position history records'
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"[Error] Failed to clear heatmap history: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


#-------------------------Test-remove below when we ship--------------------------------

#testing endpoint for when we dont have acces to cameras
@camera_config_bp.route('/test/mock-stream')
def mock_stream():

    def generate():
        import random

        # Simulate 2 people moving
        people = {
            'person_1': {'x': 2.0, 'y': 2.0, 'dx': 0.2, 'dy': 0.1},
            'person_2': {'x': 8.0, 'y': 7.0, 'dx': -0.15, 'dy': -0.2}
        }

        # Add database batch insert for heatmap
        position_batch = []
        last_db_insert = time.time()
        BATCH_INSERT_INTERVAL = 5.0

        while True:
            for track_id, person in people.items():
                # Update position
                person['x'] += person['dx']
                person['y'] += person['dy']

                # Bounce off walls (assuming 10x10m room)
                if person['x'] <= 0 or person['x'] >= 10:
                    person['dx'] *= -1
                if person['y'] <= 0 or person['y'] >= 10:
                    person['dy'] *= -1

                # Send position update
                data = {
                    'track_id': track_id,
                    'x_m': round(person['x'], 2),
                    'y_m': round(person['y'], 2)
                }
                yield f"data: {json.dumps(data)}\n\n"

                # Add to batch for database
                position_batch.append({
                    'track_id': track_id,
                    'x_m': round(person['x'], 2),
                    'y_m': round(person['y'], 2),
                    'timestamp': datetime.utcnow()
                })

            # Insert positions to database every 5 seconds
            current_time = time.time()
            if position_batch and (current_time - last_db_insert) >= BATCH_INSERT_INTERVAL:
                try:
                    db.session.bulk_insert_mappings(PositionHistory, position_batch)
                    db.session.commit()
                    position_batch.clear()
                    last_db_insert = current_time
                    print(f"[Mock Stream] Saved batch of positions to database for heatmap")
                except Exception as e:
                    db.session.rollback()
                    print(f"[Error] Failed to insert mock positions to DB: {e}")
                    position_batch.clear()

            time.sleep(0.5)  # Update every 0.5 seconds

    return Response(stream_with_context(generate()),
                    mimetype='text/event-stream')





#Test
@camera_config_bp.route('/test/calc-position', methods=['POST', 'OPTIONS'])
def calculate_position():
    """
    Test endpoint to calculate floorplan position from GPS coordinates
    POST body example:
    {
        "latitude": 58.396,
        "longitude": 15.578
    }
    """
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    data = request.get_json()
    lat = data.get('latitude', 58.396)
    lon = data.get('longitude', 15.578)

    # Use same bottom-left coord as stream endpoint
    # [58.39775183023039,15.576700744793811]
    tmp_bottom_left_coord = [58.39775183023039, 15.576700744793811]

    pos_on_floorplan = FloorplanManager.calculate_position_on_floorplan(
        float(lat), float(lon), tmp_bottom_left_coord
    )

    result = {
        'x_m': pos_on_floorplan['x_m'],
        'y_m': pos_on_floorplan['y_m'],
    }

    return jsonify(result), 200
