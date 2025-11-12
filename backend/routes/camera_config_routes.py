
#Camera Configuration Routes
#geolocation, orientation and restart
#Will test with cameras 12/11

import json
import os
import time
import requests
from requests.auth import HTTPDigestAuth, HTTPBasicAuth
from infrastructure.mqtt_client import get_events
from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from functools import wraps
from domain.models import Camera
import traceback
from infrastructure.floorplan_handler import FloorplanManager

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
    if is_longitude:
        # Format as +/-XXX.XXXX (3 digits before decimal)
        if val >= 0:
            return f"{val:07.4f}"  # Total 7 chars: 3 digits + dot + 4 decimals
        else:
            return f"{val:08.4f}"  # Total 8 chars with minus sign
    else:
        # Format as +/-XX.XXXX (2 digits before decimal)
        if val >= 0:
            return f"{val:06.4f}"  # Total 6 chars: 2 digits + dot + 4 decimals
        else:
            return f"{val:07.4f}"  # Total 7 chars with minus sign

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
            cameras = Camera.query.filter(Camera.floorplan_id == None).all()

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
    """
    Configure camera in one request
    Request body:
    {
        "latitude": 58.3977,
        "longitude": 15.5765,
        "tilt": -45.0,
        "heading": 90.0,
        "elevation": 0.0,  (optional)
        "installation_height": 3.5,
        "restart": true  (optional, default: false)
    }
    """
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    data = request.get_json()
    results = {"camera_id": camera_id, "steps": []}

    #Set Geolocation
    if "latitude" in data and "longitude" in data:
        response, error, formatted_lat, formatted_lng = set_geolocation(
            g.camera_ip, data["latitude"], data["longitude"]
        )

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

@camera_config_bp.route('/stream/positions')
def stream_positions():
    def generate():

        tmp_bottom_left_coord = [58.395908306412494, 15.577992051878446]
        last_sent = {}
        while True:
            for event in get_events():
                payload = event.get('payload', {})
                if isinstance(payload, dict) and 'frame' in payload:
                    obs_list = payload['frame'].get('observations', [])
                    for obs in obs_list:
                        track_id = obs.get('track_id')
                        geo = obs.get('geoposition', {})
                        if track_id and geo:
                            lat = geo.get('latitude')
                            lon = geo.get('longitude')
                            if lat is not None and lon is not None:
                                pos_on_floorplan = FloorplanManager.calculate_position_on_floorplan(
                                    float(lat), float(lon), tmp_bottom_left_coord
                                )
                                data = {
                                    'track_id': track_id,
                                    'x_m': pos_on_floorplan['x_m'],
                                    'y_m': pos_on_floorplan['y_m'],
                                }
                                if last_sent.get(track_id) != data:
                                    yield f"data: {json.dumps(data)}\n\n"
                                    last_sent[track_id] = data
            time.sleep(0.5)
    return Response(stream_with_context(generate()),
                    mimetype='text/event-stream')

