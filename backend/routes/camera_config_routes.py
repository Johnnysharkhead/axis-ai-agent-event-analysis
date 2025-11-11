"""
Camera Configuration Routes
Handles camera geolocation, orientation, and restart operations
"""
import os
import requests
from requests.auth import HTTPDigestAuth, HTTPBasicAuth
from flask import Blueprint, request, jsonify

camera_config_bp = Blueprint('camera_config', __name__)

# Camera configuration from environment
CAMERA_IPS = {
    1: os.getenv("CAMERA1_IP", "192.168.0.97"),
    2: os.getenv("CAMERA2_IP", "192.168.0.98"),
    3: os.getenv("CAMERA3_IP", "192.168.0.96")
}
CAMERA_USER = os.getenv("camera_login", "root")
CAMERA_PASS = os.getenv("camera_password", "pass")


def camera_request(url, timeout=10):
    """
    Make authenticated request to camera, trying both Basic and Digest auth
    (similar to curl --anyauth)
    """
    # Try Basic auth first
    response = requests.get(url, auth=HTTPBasicAuth(CAMERA_USER, CAMERA_PASS), timeout=timeout)

    # If 401, try Digest auth
    if response.status_code == 401:
        response = requests.get(url, auth=HTTPDigestAuth(CAMERA_USER, CAMERA_PASS), timeout=timeout)

    return response


def _build_cors_preflight_response():
    """Handle CORS preflight OPTIONS requests"""
    response = jsonify({"message": "CORS preflight"})
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS")
    return response


def format_coordinate(value, is_longitude=False):
    """
    Format coordinate to ISO 6709 standard
    - Latitude: 2 digits before decimal (e.g., 58.3977)
    - Longitude: 3 digits before decimal with leading zero if needed (e.g., 015.5765)
    """
    val = float(value)
    if is_longitude:
        # Format as +/-XXX.XXXX (3 digits before decimal)
        if val >= 0:
            return f"{val:07.4f}"  # Total 8 chars: 3 digits + dot + 4 decimals
        else:
            return f"{val:08.4f}"  # Total 9 chars with minus sign
    else:
        # Format as +/-XX.XXXX (2 digits before decimal)
        if val >= 0:
            return f"{val:06.4f}"  # Total 7 chars: 2 digits + dot + 4 decimals
        else:
            return f"{val:07.4f}"  # Total 8 chars with minus sign


@camera_config_bp.route("/cameras/<int:camera_id>/geolocation", methods=["POST", "OPTIONS"])
def set_camera_geolocation(camera_id):
    """Set camera geolocation (latitude, longitude)"""
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if camera_id not in CAMERA_IPS:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    data = request.get_json()
    lat = data.get("latitude")
    lng = data.get("longitude")

    if lat is None or lng is None:
        return jsonify({"error": "latitude and longitude are required"}), 400

    camera_ip = CAMERA_IPS[camera_id]

    # Format coordinates according to ISO 6709
    formatted_lat = format_coordinate(lat, is_longitude=False)
    formatted_lng = format_coordinate(lng, is_longitude=True)

    url = f"http://{camera_ip}/axis-cgi/geolocation/set.cgi?lat={formatted_lat}&lng={formatted_lng}"

    try:
        response = camera_request(url)

        if response.status_code == 200:
            return jsonify({
                "success": True,
                "camera_id": camera_id,
                "latitude": formatted_lat,
                "longitude": formatted_lng,
                "response": response.text
            }), 200
        else:
            return jsonify({
                "error": "Failed to set geolocation",
                "status_code": response.status_code,
                "response": response.text
            }), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Connection error: {str(e)}"}), 500


@camera_config_bp.route("/cameras/<int:camera_id>/orientation", methods=["POST", "OPTIONS"])
def set_camera_orientation(camera_id):
    """Set camera orientation (tilt, heading, elevation, installation height)"""
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if camera_id not in CAMERA_IPS:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    data = request.get_json()
    tilt = data.get("tilt")
    heading = data.get("heading")
    elevation = data.get("elevation")
    inst_height = data.get("installation_height")

    if tilt is None or heading is None or inst_height is None:
        return jsonify({"error": "tilt, heading, and installation_height are required"}), 400

    camera_ip = CAMERA_IPS[camera_id]

    # Build URL with required parameters
    url = f"http://{camera_ip}/axis-cgi/geoorientation/geoorientation.cgi?action=set&tilt={tilt}&heading={heading}&inst_height={inst_height}"

    # Add optional elevation parameter if provided
    if elevation is not None:
        url += f"&elevation={elevation}"

    try:
        response = camera_request(url)

        result = {
            "success": True,
            "camera_id": camera_id,
            "tilt": tilt,
            "heading": heading,
            "installation_height": inst_height,
            "response": response.text
        }

        if elevation is not None:
            result["elevation"] = elevation

        if response.status_code == 200:
            return jsonify(result), 200
        else:
            return jsonify({
                "error": "Failed to set orientation",
                "status_code": response.status_code,
                "response": response.text
            }), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Connection error: {str(e)}"}), 500


@camera_config_bp.route("/cameras/<int:camera_id>/restart", methods=["POST", "OPTIONS"])
def restart_camera(camera_id):
    """Restart camera"""
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if camera_id not in CAMERA_IPS:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    camera_ip = CAMERA_IPS[camera_id]
    url = f"http://{camera_ip}/axis-cgi/restart.cgi"

    try:
        response = camera_request(url)

        if response.status_code == 200:
            return jsonify({
                "success": True,
                "camera_id": camera_id,
                "message": "Camera restart initiated"
            }), 200
        else:
            return jsonify({
                "error": "Failed to restart camera",
                "status_code": response.status_code,
                "response": response.text
            }), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Connection error: {str(e)}"}), 500


@camera_config_bp.route("/cameras/<int:camera_id>/configure", methods=["POST", "OPTIONS"])
def configure_camera(camera_id):
    """
    Configure camera geolocation, orientation, and restart in one request

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
        return _build_cors_preflight_response()

    if camera_id not in CAMERA_IPS:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    data = request.get_json()
    results = {"camera_id": camera_id, "steps": []}

    # Step 1: Set Geolocation
    if "latitude" in data and "longitude" in data:
        lat = data["latitude"]
        lng = data["longitude"]
        camera_ip = CAMERA_IPS[camera_id]

        formatted_lat = format_coordinate(lat, is_longitude=False)
        formatted_lng = format_coordinate(lng, is_longitude=True)

        url = f"http://{camera_ip}/axis-cgi/geolocation/set.cgi?lat={formatted_lat}&lng={formatted_lng}"

        try:
            response = camera_request(url)
            results["steps"].append({
                "step": "geolocation",
                "success": response.status_code == 200,
                "latitude": formatted_lat,
                "longitude": formatted_lng
            })
        except requests.exceptions.RequestException as e:
            results["steps"].append({
                "step": "geolocation",
                "success": False,
                "error": str(e)
            })

    # Step 2: Set Orientation
    if "tilt" in data and "heading" in data and "installation_height" in data:
        tilt = data["tilt"]
        heading = data["heading"]
        elevation = data.get("elevation")
        inst_height = data["installation_height"]
        camera_ip = CAMERA_IPS[camera_id]

        url = f"http://{camera_ip}/axis-cgi/geoorientation/geoorientation.cgi?action=set&tilt={tilt}&heading={heading}&inst_height={inst_height}"

        # Add optional elevation parameter if provided
        if elevation is not None:
            url += f"&elevation={elevation}"

        try:
            response = camera_request(url)
            step_result = {
                "step": "orientation",
                "success": response.status_code == 200,
                "tilt": tilt,
                "heading": heading,
                "installation_height": inst_height
            }
            if elevation is not None:
                step_result["elevation"] = elevation
            results["steps"].append(step_result)
        except requests.exceptions.RequestException as e:
            results["steps"].append({
                "step": "orientation",
                "success": False,
                "error": str(e)
            })

    # Step 3: Restart (optional)
    if data.get("restart", False):
        camera_ip = CAMERA_IPS[camera_id]
        url = f"http://{camera_ip}/axis-cgi/restart.cgi"

        try:
            response = camera_request(url)
            results["steps"].append({
                "step": "restart",
                "success": response.status_code == 200,
                "message": "Camera restart initiated"
            })
        except requests.exceptions.RequestException as e:
            results["steps"].append({
                "step": "restart",
                "success": False,
                "error": str(e)
            })

    # Check overall success
    all_success = all(step.get("success", False) for step in results["steps"])
    results["success"] = all_success

    return jsonify(results), 200 if all_success else 207  # 207 = Multi-Status


@camera_config_bp.route("/cameras/<int:camera_id>/geolocation", methods=["GET", "OPTIONS"])
def get_camera_geolocation(camera_id):
    """Get current camera geolocation"""
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if camera_id not in CAMERA_IPS:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    camera_ip = CAMERA_IPS[camera_id]
    url = f"http://{camera_ip}/axis-cgi/geolocation/get.cgi"

    try:
        response = camera_request(url)

        if response.status_code == 200:
            return jsonify({
                "success": True,
                "camera_id": camera_id,
                "response": response.text
            }), 200
        else:
            return jsonify({
                "error": "Failed to get geolocation",
                "status_code": response.status_code,
                "response": response.text
            }), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Connection error: {str(e)}"}), 500


@camera_config_bp.route("/cameras/<int:camera_id>/orientation", methods=["GET", "OPTIONS"])
def get_camera_orientation(camera_id):
    """Get current camera orientation"""
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if camera_id not in CAMERA_IPS:
        return jsonify({"error": f"Camera {camera_id} not found"}), 404

    camera_ip = CAMERA_IPS[camera_id]
    url = f"http://{camera_ip}/axis-cgi/geoorientation/geoorientation.cgi?action=get"

    try:
        response = camera_request(url)

        if response.status_code == 200:
            return jsonify({
                "success": True,
                "camera_id": camera_id,
                "response": response.text
            }), 200
        else:
            return jsonify({
                "error": "Failed to get orientation",
                "status_code": response.status_code,
                "response": response.text
            }), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Connection error: {str(e)}"}), 500
