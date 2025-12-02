from domain.models import Floorplan, Camera
import math
import traceback
import os
import cv2
import numpy as np
from shapely.geometry import Polygon, LineString, Point

    
class FloorplanManager:
    @staticmethod
    def meters_to_lat(delta_m):
        return delta_m / 111320.0  # meters per degree latitude

    @staticmethod
    def meters_to_lon(delta_m, lat_deg):
        return delta_m / (111320.0 * math.cos(math.radians(lat_deg)))  # meters per degree longitude
    
    @staticmethod
    def lat_to_meters(delta_lat):
        """Convert latitude degrees to meters."""
        return delta_lat * 111320.0

    @staticmethod
    def lon_to_meters(delta_lon, lat_deg):
        """Convert longitude degrees to meters."""
        return delta_lon * 111320.0 * math.cos(math.radians(lat_deg))

    @staticmethod
    def get_floorplan_coordinates(floorplan_dimensions, camera, placed_coords=None):
        width, depth = map(float, floorplan_dimensions)
        cam_lat = float(camera.lat)
        cam_lon = float(camera.lon)
        placed_lon = placed_coords[0]
        placed_lat = placed_coords[1]
        
        upper_lat_delta = depth - placed_lat
        lower_lat_delta = placed_lat

        righter_lon_delta = width - placed_lon
        lefter_lon_delta = placed_lon

        top_left = (cam_lat + FloorplanManager.meters_to_lat(upper_lat_delta), cam_lon - FloorplanManager.meters_to_lon(lefter_lon_delta, cam_lat))
        top_right = (cam_lat + FloorplanManager.meters_to_lat(upper_lat_delta), cam_lon + FloorplanManager.meters_to_lon(righter_lon_delta, cam_lat))
        bottom_left = (cam_lat - FloorplanManager.meters_to_lat(lower_lat_delta), cam_lon - FloorplanManager.meters_to_lon(lefter_lon_delta, cam_lat))  
        bottom_right = (cam_lat - FloorplanManager.meters_to_lat(lower_lat_delta), cam_lon + FloorplanManager.meters_to_lon(righter_lon_delta, cam_lat))
        return {
            "top_left": top_left,
            "top_right": top_right,
            "bottom_left": bottom_left,
            "bottom_right": bottom_right
        }
    
    @staticmethod
    def calculate_position_on_floorplan(object_lat, object_lon, bottom_left_coords):
        # bottom_lat, bottom_lon = bottom_left_coords
        # [58.395905940369715, 15.577995083109268]
        
        # [58.39775780178047, 15.576700990688561]
        
        # KY25:
        bottom_lat = 58.39590610056573
        bottom_lon = 15.577997451724473

        # KAMERARUMMET:
        # bottom_lat = 58.39775780178047
        # bottom_lon = 15.576700990688561

        # ISYTAN BG22:
        # bottom_lat = 58.398507956731734
        # bottom_lon = 15.576679088842802
        
        print(f"object_lat : {object_lat}")
        print(f"object_lon : {object_lon}")
        print(f"bottom_lat : {bottom_lat}")
        print(f"bottom_lon : {bottom_lon}")


        delta_lat = object_lat - bottom_lat
        delta_lon = object_lon - bottom_lon

        print(f"delta_lat : {delta_lat}")
        print(f"delta_lon : {delta_lon}")


        y_m = FloorplanManager.lat_to_meters(delta_lat)
        x_m = FloorplanManager.lon_to_meters(delta_lon, object_lat)
        print(f"x_m : {x_m}")
        print(f"y_m : {y_m}")
        
        return {"x_m": abs(x_m), "y_m": abs(y_m)}

        
    @staticmethod
    def get_wall_polygons(floorplan_name):
        """
        Vectorizes a floorplan image to extract wall polygons.
        This is a placeholder implementation. For a real-world scenario,
        you would want to cache the results of this function.
        """

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        image_path = os.path.join(base_dir, 'static', 'images', 'floorplans', f"{floorplan_name}.png")

        if not os.path.exists(image_path):
            print(f"Image not found at {image_path}")
            return []

            
        image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if image is None:
            print(f"Failed to read image at {image_path}")
            return []
            
        # Invert the image so walls are white (for findContours)
        _, thresholded = cv2.threshold(image, 127, 255, cv2.THRESH_BINARY_INV)
        
        # Use RETR_LIST to get all contours, not just the outer one.
        # This treats each wall segment as a separate polygon, which is better
        # for ray-casting calculations.
        contours, _ = cv2.findContours(thresholded, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        # Get floorplan dimensions to scale the polygons
        floorplan = Floorplan.query.filter_by(name=floorplan_name).first()
        if not floorplan:
            return []

        polygons = []
        # We iterate through all contours, but only process the ones that are "holes" or inner boundaries.
        # In a CCOMP hierarchy, contours without a parent (hierarchy[0][i][3] == -1) are outer boundaries.
        # We are interested in the inner ones.
        for contour in contours:
            # Simplify the contour to reduce vertex count
            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx_contour = cv2.approxPolyDP(contour, epsilon, True)

            img_height, img_width = image.shape[:2]
            scale_x = floorplan.width / img_width
            scale_y = floorplan.depth / img_height

            if len(approx_contour) >= 3:
                # Scale and flip the Y-axis to match your room coordinate system
                points = [
                    (
                        p[0][0] * scale_x,
                        floorplan.depth - (p[0][1] * scale_y)
                    ) for p in approx_contour
                ]
                polygons.append(Polygon(points))

        return polygons
