from flask import Blueprint, jsonify, request
from domain.models import db
from domain.models.zone import (
    create_zone, delete_zone, get_zones_for_floorplan, Zone,
    create_schedule, update_schedule, delete_schedule, get_schedules_for_zone, get_current_active_schedules
)
from infrastructure.intrusion_detection import trigger_zone_intrusion
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
        This implementation uses a single DB transaction so failures roll back.
        """
        try:
            data = request.get_json() or {}
            incoming = data.get("zones") if isinstance(data, dict) else data
            if incoming is None:
                return jsonify({"error": "missing zones payload"}), 400
            if not isinstance(incoming, list):
                return jsonify({"error": "zones must be an array"}), 400

            # run replace inside a transaction so partial writes don't persist
            try:
                # begin a transactional scope
                with db.session.begin():
                    # delete existing zones for floorplan
                    Zone.query.filter_by(floorplan_id=floorplan_id).delete(synchronize_session=False)

                    created_objs = []
                    for z in incoming:
                        raw_pts = z.get("points") or z.get("coordinates") or []
                        pts = []
                        if isinstance(raw_pts, list):
                            for p in raw_pts:
                                if isinstance(p, dict) and "x" in p and "y" in p:
                                    try:
                                        x = float(p["x"]); y = float(p["y"])
                                    except Exception:
                                        raise ValueError("point coordinates must be numbers")
                                    pts.append({"x": x, "y": y})
                                else:
                                    raise ValueError("point must be object with x and y")
                        name = (z.get("name") or "").strip() or None
                        if not pts:
                            raise ValueError("each zone must have at least 3 points")
                        meta = Zone.compute_meta(pts)
                        new_zone = Zone(
                            floorplan_id=floorplan_id,
                            name=name or "Zone",
                            coordinates=pts,
                            bbox=meta["bbox"],
                            centroid=meta["centroid"]
                        )
                        db.session.add(new_zone)
                        created_objs.append(new_zone)
                    # commit happens automatically at the end of `with db.session.begin()`
                # after commit, load serialized zones
                saved = get_zones_for_floorplan(floorplan_id)
                return jsonify({"zones": saved}), 200
            except ValueError as ve:
                db.session.rollback()
                return jsonify({"error": "invalid payload", "message": str(ve)}), 400
            except Exception:
                db.session.rollback()
                traceback.print_exc()
                return jsonify({"error": "failed to save zones"}), 500
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

# schedule endpoints
@zone_bp.route("/zones/<int:zone_id>/schedules", methods=["OPTIONS", "GET", "POST"])
def zone_schedules(zone_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    if request.method == "GET":
        try:
            return jsonify({"schedules": get_schedules_for_zone(zone_id)}), 200
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "failed fetching schedules"}), 500
    if request.method == "POST":
        payload = request.get_json() or {}
        try:
            s = create_schedule(zone_id, payload)
            return jsonify(s), 201
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "failed creating schedule"}), 500

@zone_bp.route("/zones/<int:zone_id>/schedules/<int:schedule_id>", methods=["OPTIONS", "PUT", "DELETE"])
def zone_schedule_item(zone_id, schedule_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    if request.method == "PUT":
        payload = request.get_json() or {}
        try:
            s = update_schedule(schedule_id, payload)
            if not s:
                return jsonify({"error": "not found"}), 404
            return jsonify(s), 200
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "failed updating schedule"}), 500
    if request.method == "DELETE":
        try:
            ok = delete_schedule(schedule_id)
            return jsonify({"deleted": ok}), (200 if ok else 404)
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "failed deleting schedule"}), 500

# Trigger intrusion detection when object enters a zone
@zone_bp.route("/api/zone-intrusion", methods=["POST", "OPTIONS"])
def api_zone_intrusion():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    data = request.json
    camera_id = data["camera_id"]
    zone_id = data["zone_id"]
    zone_name = data["zone_name"]
    track_id = data["track_id"]
    object_xy = {"x": data["x_m"], "y": data["y_m"]}

    ok = trigger_zone_intrusion(
        camera_id=camera_id,
        zone_name=zone_name,
        zone_id=zone_id,
        track_id=track_id,
        object_xy=object_xy
    )

    return jsonify({"ok": ok})

@zone_bp.route("/api/get_active_schedules/<floorplan_id>", methods = ['OPTIONS', 'GET'])
def get_active_schedules(floorplan_id):
    
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    try:
        active_schedules, inactive_schedules = get_current_active_schedules(floorplan_id)
        return jsonify({
            "active" : [s.serialize() for s in active_schedules] if active_schedules else [],
            "inactive" : [s.serialize() for s in inactive_schedules] if inactive_schedules else [],
        })
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error' : 'failed to fecth active schedules for floorplan {floorplan_id}'}), 400
