from flask import Blueprint, jsonify, request
from domain.models import db
from domain.models.zone import create_zone, delete_zone, get_zones_for_floorplan, Zone
import traceback

zone_bp = Blueprint('zone', __name__)

def _build_cors_preflight_response():
    resp = jsonify({"message": "CORS preflight"})
    resp.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    resp.headers.add("Access-Control-Allow-Credentials", "true")
    resp.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    resp.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS")
    return resp

@zone_bp.route("/floorplan/<int:floorplan_id>/zones", methods=["OPTIONS", "GET", "PUT"])
def floorplan_zones(floorplan_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if request.method == "GET":
        try:
            zones = get_zones_for_floorplan(floorplan_id)
            return jsonify({"zones": zones}), 200
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "failed fetching zones"}), 500

    if request.method == "PUT":
        """
        Replace zones for a floorplan.
        Expected payload: { "zones": [ { "name": "...", "points": [{x,y}, ...] }, ... ] }
        The handler will delete existing zones for the floorplan and create new ones.
        """
        try:
            data = request.get_json() or {}
            incoming = data.get("zones") if isinstance(data, dict) else data
            if incoming is None:
                return jsonify({"error": "missing zones payload"}), 400

            # delete existing zones for floorplan
            try:
                Zone.query.filter_by(floorplan_id=floorplan_id).delete()
                db.session.commit()
            except Exception:
                db.session.rollback()
                # continue anyway

            saved = []
            for z in incoming:
                pts = z.get("points") or z.get("coordinates") or []
                name = z.get("name") or None
                # validate minimal shape
                if not isinstance(pts, list) or len(pts) == 0:
                    continue
                try:
                    created = create_zone(pts, floorplan_id=floorplan_id, name=name)
                    saved.append(created)
                except Exception:
                    db.session.rollback()
                    traceback.print_exc()
                    # skip failing zone

            return jsonify({"zones": saved}), 200
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "failed to save zones"}), 500

@zone_bp.route("/zones/<int:zone_id>", methods=["OPTIONS", "DELETE"])
def handle_zone(zone_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    try:
        ok = delete_zone(zone_id)
        if ok:
            return jsonify({"message": "zone deleted"}), 200
        return jsonify({"error": "zone not found"}), 404
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "failed to delete zone"}), 500