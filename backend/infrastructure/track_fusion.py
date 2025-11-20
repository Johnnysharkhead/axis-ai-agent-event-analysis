#Combines tracks from multiple cameras into single global tracks
import time
import math

class TrackFusion:
    
    #Set up the track fusion system with distance and timeout settings, 3 second and 0.5m right now
    def __init__(self, fusion_distance=0.5, track_timeout=3.0):
        self.fusion_distance = fusion_distance 
        self.track_timeout = track_timeout 

        self._global_tracks = {}  #Stores all active global tracks
        self._camera_to_global = {}  #Maps camera tracks to global IDs
        self._next_global_id = 1

    #Takes a camera observation and assigns it to a global track
    def fuse_track(self, camera_id, track_id, x_m, y_m):
        self._cleanup_stale_tracks()

        camera_track_key = (camera_id, track_id)
        now = time.time()

        #Check if we've seen this camera track before
        if camera_track_key in self._camera_to_global:
            global_id = self._camera_to_global[camera_track_key]
            if global_id in self._global_tracks:
                self._update_track_position(global_id, x_m, y_m, now)
                return global_id

        #Try to find a nearby existing track
        matched_global_id = self._find_nearby_track(x_m, y_m)
        if matched_global_id:
            self._associate_camera_track(camera_track_key, matched_global_id)
            self._merge_position(matched_global_id, x_m, y_m, now)
            return matched_global_id

        #No match found, create a new global track
        return self._create_new_track(camera_track_key, x_m, y_m, now)

    #Get the current position of a global track
    def get_track_position(self, global_id):
        track = self._global_tracks.get(global_id)
        if track:
            return {'x_m': track['x_m'], 'y_m': track['y_m']}
        return None

    #Get all active tracks with their positions
    def get_active_tracks(self):
        return dict(self._global_tracks)

    #Count how many tracks are currently active
    def get_track_count(self):
        return len(self._global_tracks)

    #Clear all tracks (useful for testing)
    def reset(self):
        self._global_tracks.clear()
        self._camera_to_global.clear()
        self._next_global_id = 1

    #Remove old tracks that haven't been seen recently
    def _cleanup_stale_tracks(self):
        now = time.time()
        stale_tracks = [
            gid for gid, data in self._global_tracks.items()
            if now - data['last_seen'] > self.track_timeout
        ]

        for gid in stale_tracks:
            del self._global_tracks[gid]
            self._camera_to_global = {
                key: val for key, val in self._camera_to_global.items()
                if val != gid
            }

    #Update position and timestamp for an existing track
    def _update_track_position(self, global_id, x_m, y_m, timestamp):
        self._global_tracks[global_id].update({
            'x_m': x_m,
            'y_m': y_m,
            'last_seen': timestamp
        })

    #Find an existing track close to the given position
    def _find_nearby_track(self, x_m, y_m):
        for gid, data in self._global_tracks.items():
            distance = self._calculate_distance(
                data['x_m'], data['y_m'],
                x_m, y_m
            )
            if distance < self.fusion_distance:
                return gid
        return None

    #Calculate straight-line distance between two points
    def _calculate_distance(self, x1, y1, x2, y2):
        return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

    #Link a camera track to a global track
    def _associate_camera_track(self, camera_track_key, global_id):
        self._camera_to_global[camera_track_key] = global_id

    #Combine new position with existing track position by averaging
    def _merge_position(self, global_id, x_m, y_m, timestamp):
        existing = self._global_tracks[global_id]
        self._global_tracks[global_id].update({
            'x_m': (existing['x_m'] + x_m) / 2,
            'y_m': (existing['y_m'] + y_m) / 2,
            'last_seen': timestamp
        })

    #Create a brand new global track
    def _create_new_track(self, camera_track_key, x_m, y_m, timestamp):
        new_global_id = f"global_{self._next_global_id}"
        self._next_global_id += 1

        self._global_tracks[new_global_id] = {
            'x_m': x_m,
            'y_m': y_m,
            'last_seen': timestamp
        }
        self._camera_to_global[camera_track_key] = new_global_id

        return new_global_id