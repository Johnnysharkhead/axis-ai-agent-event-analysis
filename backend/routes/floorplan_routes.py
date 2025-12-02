from flask import Blueprint, send_from_directory, jsonify, request, Response
from domain.models import db, Floorplan, Camera
import os
from infrastructure.floorplan_handler import FloorplanManager
from shapely.geometry import Point, LineString, mapping, Polygon
import traceback
import math

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
            import traceback, sys
            traceback.print_exc()
            return jsonify({
                "error": "failed fetching floorplans from db",
                "details": str(e) # Added this so we can get details when it is not working
            }),404
        
    elif request.method == "POST":
        try:
            json_data = request.get_json()
            floorplan_name = json_data.get('floorplan_name')
            floorplan_width = json_data.get('floorplan_width')
            floorplan_depth = json_data.get('floorplan_depth')
            floorplan = Floorplan(
                name = floorplan_name,
                width = floorplan_width,
                depth = floorplan_depth,
            )

            db.session.add(floorplan)
            db.session.flush()

            new_floorplan_id = floorplan.id
            db.session.commit()

            return jsonify({'message': 'floorplan successfully added to database', 'new_floorplan_id': new_floorplan_id}), 200
        
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error' : 'failed to add floorplan to database'}), 400
            
@floorplan_bp.route("/floorplan/<floorplan_id>", methods=["GET", "PUT", "DELETE", "OPTIONS", "PATCH"])
def handle_floorplan(floorplan_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    try: 
        floorplan = Floorplan.query.filter_by(id=floorplan_id).first()
    except Exception as e:
        return jsonify({'error': 'Error when fetching floorplan'}), 400

    if request.method == "GET":
        return jsonify({'floorplan': floorplan.serialize()}), 200
    if request.method == "DELETE":
        if not floorplan:
            return jsonify({'error': 'Floorplan not found'}), 404

        try:
            db.session.delete(floorplan)
            db.session.commit()
            return jsonify({'message': 'Floorplan deleted successfully'}), 200
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': 'Failed to delete floorplan'}), 500

    # Lägg till en fallback för metoder som inte hanteras
    #return jsonify({'error': f'Method {request.method} not allowed for this route'}), 405
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
                return jsonify({'error' : "camera ID is required"}), 400
            
            camera = Camera.query.filter_by(id=camera_id, floorplan_id=floorplan_id).first()
            if not camera:
                return jsonify({'error' : "no camera found."}), 404
            
            camera.floorplan_id = None

            if floorplan.camera_floorplancoordinates and str(camera_id) in floorplan.camera_floorplancoordinates:
                del floorplan.camera_floorplancoordinates[str(camera_id)]
            db.session.commit()
            return jsonify({'message' : 'camera removed from floorplan successfully'})
        except Exception as e:
            return jsonify({'error' : 'failed to remove floorplan from floorplan {floorplan_id}'})
        
@floorplan_bp.route("/floorplan/<floorplan_id>/walls", methods=["GET", "OPTIONS"])
def get_floorplan_walls(floorplan_id):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    try:
        floorplan = Floorplan.query.filter_by(id=floorplan_id).first()
        if not floorplan:
            return jsonify({'error' : 'floorplan not found in database'}), 404

        wall_polygons = FloorplanManager.get_wall_polygons(floorplan.name)
        
        walls_data = []
        for poly in wall_polygons:
            wall_coords = mapping(poly)['coordinates'][0] # Get the exterior ring
            walls_data.append([{'x': x, 'y': y} for x, y in wall_coords])

        return jsonify({'walls': walls_data}), 200
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error' : 'failed to get wall polygons'}), 500
@floorplan_bp.route("/floorplan/<floorplan_id>/camera/<camera_id>/occluded_fov", methods=["GET", "OPTIONS"])
def get_occluded_fov(floorplan_id, camera_id):
    
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    
    try:
        floorplan = Floorplan.query.filter_by(id=floorplan_id).first()
        camera = Camera.query.filter_by(id=camera_id).first()

        if not camera:
            return jsonify({'error': 'camera not found in database'}), 404
        elif not floorplan:
            return jsonify({'error' : 'floorplan not found in database'}), 404
        
        cam_coords = floorplan.camera_floorplancoordinates[str(camera_id)]
        print(f"cam_coords: {cam_coords}")
        if not cam_coords:
            return jsonify({'error' : 'Camera is not placed on selected floorplan'}), 404

        cam_x, cam_y = cam_coords
        cam_point = Point(cam_x, cam_y)
        print(camera.heading_deg)

        wall_polygons = FloorplanManager.get_wall_polygons(floorplan.name)
        # Create a polygon for the room boundary to ensure rays stop at the edge
        room_boundary = Polygon([
            (0, 0), 
            (floorplan.width, 0), 
            (floorplan.width, floorplan.depth), 
            (0, floorplan.depth)
        ])
        wall_polygons.append(room_boundary)
        fov_range = 20
        half_fov_deg = 33.5
        num_rays = 100

        # Convert navigational heading (0=North, clockwise) to mathematical angle (0=East, counter-clockwise)
        math_heading_deg = (450 - camera.heading_deg) % 360

        start_deg = math_heading_deg - half_fov_deg
        end_deg = math_heading_deg + half_fov_deg
        occluded_points = []
        
        for i in range(num_rays + 1):
            
            current_angle_deg = start_deg + (i / num_rays) * (end_deg - start_deg)

            map_angle_rad = math.radians(current_angle_deg)

            ray_end_x = cam_x + fov_range * math.cos(map_angle_rad)
            ray_end_y = cam_y + fov_range * math.sin(map_angle_rad)

            closest_intersection = Point(ray_end_x, ray_end_y)

            min_dist_sq = fov_range ** 2

            for wall in wall_polygons:
                ray = LineString([cam_point, closest_intersection]) # Recreate the ray with the current closest intersection
                if ray.intersects(wall):
                    intersection = ray.intersection(wall)

                    if intersection.geom_type == 'Point':
                        dist_sq = cam_point.distance(intersection) ** 2
                        if dist_sq < min_dist_sq and dist_sq > 1e-9:
                            min_dist_sq = dist_sq
                            closest_intersection = intersection
                    elif intersection.geom_type in ['MultiPoint', 'LineString', 'MultiLineString']:
                        for p in intersection.geoms if hasattr(intersection, 'geoms') else [intersection]:
                            
                            for point_candidate in list(p.coords):
                                pt = Point(point_candidate)
                                dist_sq = cam_point.distance(pt) ** 2
                                if dist_sq < min_dist_sq and dist_sq > 1e-9:
                                    min_dist_sq = dist_sq
                                    closest_intersection = pt
            occluded_points.append({'x' : closest_intersection.x, 'y' : closest_intersection.y})

        final_fov_polygon = [{'x': cam_x, 'y' : cam_y}] + occluded_points

        return jsonify({'fov_polygon': final_fov_polygon}), 200
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error' : 'failed to calculate occluded FOV'}), 500
