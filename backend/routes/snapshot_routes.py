from flask import Blueprint, jsonify, send_file
import requests
from datetime import datetime
import os
from domain.models import db
from domain.models.camera import Camera
from domain.models.recording import Snapshot, Recording
from infrastructure.livestream import VideoCamera


snapshot_bp = Blueprint('snapshot', __name__)

cameras = {
    1: VideoCamera(os.getenv("CAMERA1_IP", "192.168.0.97")),
    2: VideoCamera(os.getenv("CAMERA2_IP", "192.168.0.98")),
    3: VideoCamera(os.getenv("CAMERA3_IP", "192.168.0.96"))
}

@snapshot_bp.route('/api/recordings/<int:recording_id>/snapshots/capture', methods=['POST'])
def capture_snapshot(recording_id):
    """Capture a snapshot for a specific recording"""
    try:
        # Check if recording exists
        recording = Recording.query.get(recording_id)
        if not recording:
            return jsonify({'error': 'Recording not found'}), 404
        
        # Extract camera_id from recording_id (first digit)
        camera_id = int(str(recording_id)[0])
        print(f"Extracted camera_id: {camera_id} from recording_id: {recording_id}")
        camera = cameras.get(camera_id)
        if not camera:
            return jsonify({'error': 'Camera not found'}), 404
        
        # Capture snapshot from camera
        image_url = f"http://{camera.ip}/axis-cgi/jpg/image.cgi"
        response = requests.get(
            image_url,
            auth=(camera.username, camera.password),
            timeout=10
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'Failed to capture snapshot. Status: {response.status_code}'}), 500
        
        # Save snapshot in the recording's directory (already exists)
        recording_dir = recording.url
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"snapshot_{timestamp}.jpg"
        filepath = os.path.join(recording_dir, filename)
        
        # Save image file
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        # Save to database
        snapshot = Snapshot(
            recording_id=recording_id,
            url=filepath
        )
        db.session.add(snapshot)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'snapshot': {
                'id': snapshot.id,
                'recording_id': snapshot.recording_id,
                'url': snapshot.url,
                'timestamp': snapshot.timestamp.isoformat(),
                'file_size': len(response.content)
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@snapshot_bp.route('/api/recordings/<int:recording_id>/snapshots', methods=['GET'])
def get_recording_snapshots(recording_id):
    """Get all snapshots for a specific recording"""
    recording = Recording.query.get(recording_id)
    if not recording:
        return jsonify({'error': 'Recording not found'}), 404
    
    snapshots = Snapshot.query.filter_by(recording_id=recording_id).order_by(Snapshot.timestamp.desc()).all()
    
    return jsonify({
        'recording_id': recording_id,
        'snapshots': [{
            'id': s.id,
            'url': s.url,
            'timestamp': s.timestamp.isoformat()
        } for s in snapshots]
    })


@snapshot_bp.route('/api/snapshots/<int:snapshot_id>', methods=['GET'])
def get_snapshot_image(snapshot_id):
    """Get the actual snapshot image file"""
    snapshot = Snapshot.query.get(snapshot_id)
    if not snapshot:
        return jsonify({'error': 'Snapshot not found'}), 404
    
    if not os.path.exists(snapshot.url):
        return jsonify({'error': 'Snapshot file not found on disk'}), 404
    
    return send_file(snapshot.url, mimetype='image/jpeg')


@snapshot_bp.route('/api/snapshots/<int:snapshot_id>', methods=['DELETE'])
def delete_snapshot(snapshot_id):
    """Delete a snapshot (both file and database entry)"""
    try:
        snapshot = Snapshot.query.get(snapshot_id)
        if not snapshot:
            return jsonify({'error': 'Snapshot not found'}), 404
        
        # Delete the file from disk
        if os.path.exists(snapshot.url):
            os.remove(snapshot.url)
        
        # Delete from database
        db.session.delete(snapshot)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Snapshot deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===== TEST ENDPOINT (No database, just to test camera snapshot functionality) =====

@snapshot_bp.route('/api/cameras/<int:camera_id>/test-snapshot', methods=['POST'])
def test_capture_snapshot(camera_id):
    """Test endpoint to capture a snapshot from a camera (no database storage)"""
    try:
        # Use the hardcoded cameras instead of database
        if camera_id not in cameras:
            return jsonify({'error': f'Camera {camera_id} not found. Available cameras: {list(cameras.keys())}'}), 404
        
        video_camera = cameras[camera_id]
        
        # Capture snapshot from camera (use .username and .password from VideoCamera class)
        image_url = f"http://{video_camera.ip}/axis-cgi/jpg/image.cgi"
        response = requests.get(
            image_url,
            auth=(video_camera.username, video_camera.password),  # Correct attributes
            timeout=10
        )
        print("username:", video_camera.username, "password:", video_camera.password)
        if response.status_code != 200:
            return jsonify({'error': f'Failed to capture snapshot. Status: {response.status_code}'}), 500
        
        # Create test snapshot directory
        test_dir = os.path.join("snapshots", "test_snapshots")
        os.makedirs(test_dir, exist_ok=True)
        
        # Save image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"camera{camera_id}_{timestamp}.jpg"
        filepath = os.path.join(test_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        return jsonify({
            'success': True,
            'message': 'Test snapshot captured successfully (not saved to database)',
            'filepath': filepath,
            'timestamp': timestamp,
            'camera_id': camera_id,
            'file_size': len(response.content)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500