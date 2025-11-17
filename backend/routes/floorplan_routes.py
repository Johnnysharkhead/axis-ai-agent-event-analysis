from flask import Blueprint, send_from_directory, jsonify, request, Response
from domain.models import db, Floorplan, Camera
import os
from infrastructure.floorplan_handler import FloorplanManager
import traceback
floorplan_bp = Blueprint('floorplan', __name__)

def _build_cors_preflight_response():
    """Handle CORS preflight OPTIONS requests"""
    response = jsonify({"message": "CORS preflight"})
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS")
    return response

@floorplan_bp.route("/floorplan", methods = ["GET", "POST", "OPTIONS"])
def floorplans():
    
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    

    if request.method == "GET":
        try:
            floorplans = Floorplan.query.all()

            if floorplans:
                return jsonify({"floorplans" : [floorplan.serialize() for floorplan in floorplans]}), 200
            return jsonify({"message": "no floorplans in database"}), 200
        
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": "failed fetching floorplans from db"}), 404
        
    elif request.method == "POST":
        try:
            json_data = request.get_json()
            floorplan_name = json_data.get('floorplan_name')
            floorplan_width = json_data.get('floorplan_width')
            floorplan_depth = json_data.get('floorplan_depth')
            camera_height = json_data.get('camera_height')
            floorplan = Floorplan(
                name = floorplan_name,
                width = floorplan_width,
                depth = floorplan_depth,
                camera_height = camera_height
            )

            db.session.add(floorplan)
            db.session.flush()

            new_floorplan_id = floorplan.id
            db.session.commit()

            return jsonify({'message': 'floorplan successfully added to database', 'new_floorplan_id': new_floorplan_id}), 200
        
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error' : 'failed to add floorplan to database'}), 400
            
@floorplan_bp.route("/floorplan/<floorplan_id>", methods = ["GET", "PUT", "DELETE", "OPTIONS", "PATCh"])
def handle_floorplan(floorplan_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    try: 
        floorplan = Floorplan.query.filter_by(id = floorplan_id).first()
    except Exception as e:
        return jsonify({'error' : 'error when fetching floorplan'}), 400
    
    if request.method == "GET":
        if floorplan:
            return jsonify({'floorplan' : floorplan.serialize()}), 200
        else:
            return jsonify({'Message' : 'no floorplan found.'}), 200
            
    # If want to add a camera to a specific room  
    elif request.method == "PUT":
        try:
            camera_data = request.get_json()
            camera_id = camera_data.get('camera_id')
            placed_coords = camera_data.get('placed_coords')
            camera = Camera.query.filter_by(id = camera_id).first()
            camera.floorplan_id = floorplan_id
            if not camera:
                return jsonify({"message" : "No camera with id {camera_id} found."})

            floorplan_dimensions = (floorplan.width, floorplan.depth)

            if floorplan.camera_floorplancoordinates is None:
                floorplan.camera_floorplancoordinates = {}

            if not isinstance(floorplan.camera_floorplancoordinates, dict):
                floorplan.camera_floorplancoordinates = {}

            print(f"camera_id: {camera_id}")
            print(f"placed_coords: {placed_coords}")

            floorplan.camera_floorplancoordinates[str(camera_id)] = placed_coords
            print(f"floorplan.camera_floorplancoordinates: {floorplan.camera_floorplancoordinates}")

            if isinstance(floorplan.camera_floorplancoordinates, dict) and len(floorplan.camera_floorplancoordinates) == 1:
                floorplan.corner_geocoordinates = FloorplanManager.get_floorplan_coordinates(
                    floorplan_dimensions, camera, placed_coords
                )
            
            db.session.commit()

            return jsonify({'message' : 'camera added to floorplan {floorplan_id}', 'floorplan corner coordinates' : floorplan.corner_geocoordinates}), 200
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error' : 'error while adding camera to floorplan {floorplan_id}'}), 400
        
        #Method for removing camera from floorplan
    elif request.method == "PATCH":
        
        try:
            data = request.get_json()
            camera_id = data.get("camera_id")
            print(f"camera_id: {camera_id}")
            if not camera_id:
                return jsonify({'error' : "camera ID is required"})
            
            camera = Camera.query.filter_by(id=camera_id, floorplan_id=floorplan_id).first()
            if not camera:
                return jsonify({'error' : "no camera found."})
            
            camera.floorplan_id = None

            if floorplan.camera_floorplancoordinates and str(camera_id) in floorplan.camera_floorplancoordinates:
                del floorplan.camera_floorplancoordinates[str(camera_id)]
            db.session.commit()
            return jsonify({'message' : 'camera removed from floorplan successfully'})
        except Exception as e:
            return jsonify({'error' : 'failed to remove floorplan from floorplan {floorplan_id}'})
        

