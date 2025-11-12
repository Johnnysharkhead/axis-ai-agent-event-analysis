from domain.models import Floorplan, Camera
import math
import traceback
    
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
        lat_diff = object_lat - bottom_left_coords[0]
        lon_diff = object_lon - bottom_left_coords[1]

        lat_diff_m = FloorplanManager.lat_to_meters(lat_diff)
        lon_diff_m = FloorplanManager.lon_to_meters(lon_diff, object_lat)

        return {
            "x_m": lon_diff_m,  # East-West offset in meters
            "y_m": lat_diff_m 
        }

        

