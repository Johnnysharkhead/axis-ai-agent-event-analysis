# processes MQTT events into fused position data
class PositionProcessor:
    
    #Set up the processor with fusion, floorplan, and coordinate systems
    def __init__(self, track_fusion, floorplan_manager, bottom_left_coord):
        self.track_fusion = track_fusion
        self.floorplan_manager = floorplan_manager
        self.bottom_left_coord = bottom_left_coord

    #Take an MQTT event and turn it into position data
    def process_mqtt_event(self, event):
        payload = event.get('payload', {})
        topic = event.get('topic', '')

        #Get which camera sent this
        camera_id = self._extract_camera_id(topic)
        if not camera_id:
            return []

        #Check if payload has the data we need
        if not isinstance(payload, dict) or 'frame' not in payload:
            return []

        observations = payload['frame'].get('observations', [])
        positions = []

        #Process each person detected in the frame
        for obs in observations:
            position = self._process_observation(camera_id, obs)
            if position:
                positions.append(position)

        return positions
    
    def _extract_camera_id(self, topic):
        if topic.startswith('axis/'):
            parts = topic.split('/')
            if len(parts) >= 2:
                return parts[1] 
        return None

    #Turn a single detection into a fused position
    def _process_observation(self, camera_id, obs):
        track_id = obs.get('track_id')
        geo = obs.get('geoposition', {})

        if not track_id or not geo:
            return None

        lat = geo.get('latitude')
        lon = geo.get('longitude')

        if lat is None or lon is None:
            return None

        #Convert GPS to floorplan position in meters
        pos_on_floorplan = self.floorplan_manager.calculate_position_on_floorplan(
            float(lat), float(lon), self.bottom_left_coord
        )

        #Merge this with other camera observations of same person
        global_id = self.track_fusion.fuse_track(
            camera_id,
            track_id,
            pos_on_floorplan['x_m'],
            pos_on_floorplan['y_m']
        )

        #Get the combined position from all cameras
        fused_position = self.track_fusion.get_track_position(global_id)
        return {
            'track_id': global_id,
            'x_m': fused_position['x_m'],
            'y_m': fused_position['y_m']
        }