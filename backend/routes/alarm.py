# backend/routes/alarm.py

from flask import Blueprint, jsonify
from infrastructure import alarm_control

bp = Blueprint("alarm", __name__, url_prefix="/api/alarm")

@bp.route("/play", methods=["POST"])
def play_alarm():
    """
    One-shot alarm (what you already had). Still useful as a test endpoint.
    """
    ok, payload, status = alarm_control.play_once()
    return jsonify(payload), status


@bp.route("/loop/start", methods=["POST"])
def start_alarm_loop():
    """
    Start a repeating alarm that plays every 5 seconds in the background.
    If already running, we just acknowledge.
    """
    started = alarm_control.start_loop()
    message = "Alarm loop started (plays every 5s)" if started else "Alarm loop already running"
    return jsonify({"ok": True, "message": message}), 200


@bp.route("/stop", methods=["POST"])
def stop_alarm():
    """
    Stop any running alarm loop *and* send stop commands to the speaker.
    """
    result = alarm_control.stop_loop()
    if result.get("ok"):
        return jsonify({"ok": True, "message": "Alarm loop stopped", **result}), 200
    return jsonify({"ok": False, "message": "Failed to stop alarm loop", **result}), 502


@bp.route("/list", methods=["GET"])
def list_clips():
    result = alarm_control.list_clips()
    return jsonify(result)