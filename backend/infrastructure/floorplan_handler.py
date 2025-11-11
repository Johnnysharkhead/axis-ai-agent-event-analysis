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

