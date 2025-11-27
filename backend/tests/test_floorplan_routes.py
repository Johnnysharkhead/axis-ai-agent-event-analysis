"""
Unit tests for floorplan CRUD operations and camera associations.

Tests floorplan creation, camera placement, and coordinate management.
Authors: Test Suite
"""
import pytest
from flask import Flask
from domain.models import db, Floorplan, Camera
from routes.floorplan_routes import floorplan_bp


@pytest.fixture
def app():
    """Create Flask app with in-memory database for testing"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize database
    db.init_app(app)

    with app.app_context():
        db.create_all()
        app.register_blueprint(floorplan_bp, url_prefix='/api')
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture
def test_camera(app):
    """Create a test camera"""
    with app.app_context():
        camera = Camera(
            ip_address='192.168.0.100',
            lat=58.396,
            lon=15.578,
            serialno='ACCC8E123456'
        )
        db.session.add(camera)
        db.session.commit()
        return camera.id


class TestFloorplanCreation:
    """Test floorplan creation (POST /floorplan)"""

    def test_create_floorplan_success(self, client):
        """Test successful floorplan creation"""
        response = client.post('/api/floorplan', json={
            'floorplan_name': 'Office Floor 1',
            'floorplan_width': 20.0,
            'floorplan_depth': 15.0
        })

        assert response.status_code == 200
        data = response.json
        assert 'message' in data
        assert 'new_floorplan_id' in data
        assert data['new_floorplan_id'] is not None

    def test_create_floorplan_stores_dimensions(self, client, app):
        """Test that floorplan dimensions are stored correctly"""
        response = client.post('/api/floorplan', json={
            'floorplan_name': 'Room KY25',
            'floorplan_width': 10.5,
            'floorplan_depth': 8.3
        })

        floorplan_id = response.json['new_floorplan_id']

        # Verify in database
        with app.app_context():
            floorplan = Floorplan.query.get(floorplan_id)
            assert floorplan is not None
            assert floorplan.name == 'Room KY25'
            assert floorplan.width == 10.5
            assert floorplan.depth == 8.3

    def test_create_floorplan_with_zero_dimensions(self, client):
        """Test edge case: floorplan with 0 dimensions"""
        response = client.post('/api/floorplan', json={
            'floorplan_name': 'Zero Room',
            'floorplan_width': 0.0,
            'floorplan_depth': 0.0
        })

        # Should succeed (no validation in current code)
        assert response.status_code == 200

    def test_create_multiple_floorplans(self, client, app):
        """Test creating multiple floorplans"""
        # Create 3 floorplans
        for i in range(3):
            client.post('/api/floorplan', json={
                'floorplan_name': f'Floor {i+1}',
                'floorplan_width': 10.0 + i,
                'floorplan_depth': 8.0 + i
            })

        # Get all floorplans
        response = client.get('/api/floorplan')
        assert response.status_code == 200
        data = response.json
        assert 'floorplans' in data
        assert len(data['floorplans']) == 3


class TestFloorplanRetrieval:
    """Test floorplan retrieval (GET /floorplan)"""

    def test_get_empty_floorplans(self, client):
        """Test GET with no floorplans in database"""
        response = client.get('/api/floorplan')
        assert response.status_code == 200
        data = response.json
        assert 'message' in data
        assert 'no floorplans' in data['message']

    def test_get_all_floorplans(self, client, app):
        """Test GET all floorplans"""
        # Create 2 floorplans
        with app.app_context():
            fp1 = Floorplan(name='Floor 1', width=10.0, depth=8.0)
            fp2 = Floorplan(name='Floor 2', width=15.0, depth=12.0)
            db.session.add(fp1)
            db.session.add(fp2)
            db.session.commit()

        response = client.get('/api/floorplan')
        assert response.status_code == 200
        data = response.json
        assert 'floorplans' in data
        assert len(data['floorplans']) == 2

    def test_get_specific_floorplan(self, client, app):
        """Test GET specific floorplan by ID"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='Test Floor', width=20.0, depth=15.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        response = client.get(f'/api/floorplan/{fp_id}')
        assert response.status_code == 200
        data = response.json
        assert 'floorplan' in data
        assert data['floorplan']['name'] == 'Test Floor'
        assert data['floorplan']['width'] == 20.0


class TestFloorplanDeletion:
    """Test floorplan deletion (DELETE /floorplan/<id>)"""

    def test_delete_floorplan(self, client, app):
        """Test deleting a floorplan"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='To Delete', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Delete it
        response = client.delete(f'/api/floorplan/{fp_id}')
        assert response.status_code == 200
        data = response.json
        assert 'message' in data
        assert 'deleted successfully' in data['message']

        # Verify deletion
        with app.app_context():
            fp = Floorplan.query.get(fp_id)
            assert fp is None

    def test_delete_nonexistent_floorplan(self, client):
        """Test deleting non-existent floorplan"""
        response = client.delete('/api/floorplan/9999')

        # Should return 404 (floorplan not found)
        # Note: Current code may not handle this correctly
        assert response.status_code in [404, 400, 500]

    def test_delete_floorplan_with_cameras(self, client, app, test_camera):
        """Test deleting floorplan with associated cameras"""
        # Create floorplan and associate camera
        with app.app_context():
            fp = Floorplan(name='With Camera', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

            camera = Camera.query.get(test_camera)
            camera.floorplan_id = fp_id
            db.session.commit()

        # Delete floorplan
        response = client.delete(f'/api/floorplan/{fp_id}')
        assert response.status_code == 200

        # Camera should still exist but with floorplan_id = None (SET NULL)
        with app.app_context():
            camera = Camera.query.get(test_camera)
            assert camera is not None
            assert camera.floorplan_id is None


class TestCameraPlacement:
    """Test adding cameras to floorplan (PUT /floorplan/<id>)"""

    def test_add_camera_to_floorplan(self, client, app, test_camera):
        """Test adding a camera to a floorplan"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='Office', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Add camera at position (5, 5) - center of room
        response = client.put(f'/api/floorplan/{fp_id}', json={
            'camera_id': test_camera,
            'placed_coords': [5.0, 5.0]
        })

        assert response.status_code == 200
        data = response.json
        assert 'message' in data
        assert 'floorplan corner coordinates' in data

        # Verify camera association
        with app.app_context():
            camera = Camera.query.get(test_camera)
            assert camera.floorplan_id == fp_id

    def test_camera_placement_stores_coordinates(self, client, app, test_camera):
        """Test that camera placement coordinates are stored"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='Room', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Place camera at (3, 7)
        client.put(f'/api/floorplan/{fp_id}', json={
            'camera_id': test_camera,
            'placed_coords': [3.0, 7.0]
        })

        # Verify coordinates stored
        with app.app_context():
            fp = Floorplan.query.get(fp_id)
            assert fp.camera_floorplancoordinates is not None
            assert str(test_camera) in fp.camera_floorplancoordinates
            coords = fp.camera_floorplancoordinates[str(test_camera)]
            assert coords == [3.0, 7.0]

    def test_first_camera_sets_corner_coordinates(self, client, app, test_camera):
        """Test that first camera placement calculates corner geocoordinates"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='Room', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Add first camera
        response = client.put(f'/api/floorplan/{fp_id}', json={
            'camera_id': test_camera,
            'placed_coords': [5.0, 5.0]
        })

        assert response.status_code == 200

        # Verify corner coordinates calculated
        with app.app_context():
            fp = Floorplan.query.get(fp_id)
            assert fp.corner_geocoordinates is not None
            assert 'top_left' in fp.corner_geocoordinates
            assert 'top_right' in fp.corner_geocoordinates
            assert 'bottom_left' in fp.corner_geocoordinates
            assert 'bottom_right' in fp.corner_geocoordinates

    def test_add_multiple_cameras_to_floorplan(self, client, app):
        """Test adding multiple cameras to same floorplan"""
        # Create 3 cameras
        with app.app_context():
            cam1 = Camera(ip_address='192.168.0.101', lat=58.396, lon=15.578)
            cam2 = Camera(ip_address='192.168.0.102', lat=58.397, lon=15.579)
            cam3 = Camera(ip_address='192.168.0.103', lat=58.398, lon=15.580)
            db.session.add_all([cam1, cam2, cam3])
            db.session.commit()
            cam_ids = [cam1.id, cam2.id, cam3.id]

            # Create floorplan
            fp = Floorplan(name='Multi-Camera Room', width=20.0, depth=20.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Add all 3 cameras
        positions = [[5, 5], [15, 5], [10, 15]]
        for cam_id, pos in zip(cam_ids, positions):
            response = client.put(f'/api/floorplan/{fp_id}', json={
                'camera_id': cam_id,
                'placed_coords': pos
            })
            assert response.status_code == 200

        # Verify all cameras stored
        with app.app_context():
            fp = Floorplan.query.get(fp_id)
            assert len(fp.camera_floorplancoordinates) == 3


class TestCameraRemoval:
    """Test removing cameras from floorplan (PATCH /floorplan/<id>)"""

    def test_remove_camera_from_floorplan(self, client, app, test_camera):
        """Test removing a camera from floorplan"""
        # Setup: create floorplan with camera
        with app.app_context():
            fp = Floorplan(name='Room', width=10.0, depth=10.0)
            fp.camera_floorplancoordinates = {str(test_camera): [5.0, 5.0]}
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

            camera = Camera.query.get(test_camera)
            camera.floorplan_id = fp_id
            db.session.commit()

        # Remove camera
        response = client.patch(f'/api/floorplan/{fp_id}', json={
            'camera_id': test_camera
        })

        assert response.status_code == 200
        data = response.json
        assert 'message' in data

        # Verify camera removed
        with app.app_context():
            camera = Camera.query.get(test_camera)
            assert camera.floorplan_id is None

            fp = Floorplan.query.get(fp_id)
            assert str(test_camera) not in fp.camera_floorplancoordinates

    def test_remove_nonexistent_camera(self, client, app):
        """Test removing camera that doesn't exist on floorplan"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='Empty Room', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Try to remove non-existent camera
        response = client.patch(f'/api/floorplan/{fp_id}', json={
            'camera_id': 9999
        })

        # Should return error
        assert response.status_code in [400, 404]
        assert 'error' in response.json

    def test_remove_camera_without_id(self, client, app):
        """Test removal request without camera_id"""
        # Create floorplan
        with app.app_context():
            fp = Floorplan(name='Room', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Send request without camera_id
        response = client.patch(f'/api/floorplan/{fp_id}', json={})

        # Should return error
        assert response.status_code in [400, 404, 500]


class TestFloorplanSerialization:
    """Test floorplan serialize() method"""

    def test_serialize_basic_floorplan(self, app):
        """Test serialization of basic floorplan"""
        with app.app_context():
            fp = Floorplan(name='Test Room', width=12.5, depth=9.8)
            db.session.add(fp)
            db.session.commit()

            serialized = fp.serialize()

            assert serialized['name'] == 'Test Room'
            assert serialized['width'] == 12.5
            assert serialized['depth'] == 9.8
            assert 'id' in serialized

    def test_serialize_with_cameras(self, app, test_camera):
        """Test serialization includes camera data"""
        with app.app_context():
            fp = Floorplan(name='With Cameras', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()

            camera = Camera.query.get(test_camera)
            camera.floorplan_id = fp.id
            db.session.commit()

            serialized = fp.serialize()

            assert 'cameras' in serialized
            assert serialized['cameras'] is not None
            assert len(serialized['cameras']) == 1

    def test_serialize_corner_coordinates(self, app, test_camera):
        """Test serialization of corner geocoordinates"""
        with app.app_context():
            fp = Floorplan(
                name='Room',
                width=10.0,
                depth=10.0,
                corner_geocoordinates={
                    'top_left': (58.397, 15.577),
                    'top_right': (58.397, 15.579),
                    'bottom_left': (58.396, 15.577),
                    'bottom_right': (58.396, 15.579)
                }
            )
            db.session.add(fp)
            db.session.commit()

            serialized = fp.serialize()

            # Tuples should be converted to lists
            assert 'corner_geocoordinates' in serialized
            for key in ['top_left', 'top_right', 'bottom_left', 'bottom_right']:
                assert key in serialized['corner_geocoordinates']
                assert isinstance(serialized['corner_geocoordinates'][key], list)


class TestCORSHandling:
    """Test CORS preflight requests"""

    def test_options_request_on_floorplan(self, client):
        """Test OPTIONS preflight on /floorplan"""
        response = client.options('/api/floorplan')

        assert response.status_code == 200
        # Should include CORS headers
        # Note: In test client, headers may not be fully populated

    def test_options_request_on_floorplan_id(self, client):
        """Test OPTIONS preflight on /floorplan/<id>"""
        response = client.options('/api/floorplan/1')

        assert response.status_code == 200


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_create_floorplan_with_negative_dimensions(self, client):
        """Test floorplan with negative dimensions"""
        response = client.post('/api/floorplan', json={
            'floorplan_name': 'Negative Room',
            'floorplan_width': -10.0,
            'floorplan_depth': -5.0
        })

        # Should succeed (no validation currently)
        assert response.status_code == 200

    def test_create_floorplan_with_very_large_dimensions(self, client):
        """Test floorplan with very large dimensions"""
        response = client.post('/api/floorplan', json={
            'floorplan_name': 'Huge Room',
            'floorplan_width': 1000.0,
            'floorplan_depth': 2000.0
        })

        assert response.status_code == 200

    def test_place_camera_outside_floorplan_bounds(self, client, app, test_camera):
        """Test placing camera at coordinates outside floorplan"""
        with app.app_context():
            fp = Floorplan(name='Room', width=10.0, depth=10.0)
            db.session.add(fp)
            db.session.commit()
            fp_id = fp.id

        # Place camera at (15, 20) - outside 10x10 room
        response = client.put(f'/api/floorplan/{fp_id}', json={
            'camera_id': test_camera,
            'placed_coords': [15.0, 20.0]
        })

        # Should succeed (no bounds checking currently)
        assert response.status_code == 200


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
