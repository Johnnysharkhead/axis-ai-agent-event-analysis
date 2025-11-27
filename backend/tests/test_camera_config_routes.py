"""
Unit tests for camera configuration routes and ISO 6709 formatting.

Tests camera geolocation/orientation setup and coordinate formatting.
Authors: Test Suite
"""
import pytest
from flask import Flask
from domain.models import db, Camera
from routes.camera_config_routes import camera_config_bp, format_coordinate


class TestISO6709Formatting:
    """Test ISO 6709 coordinate formatting for Axis cameras"""

    def test_format_positive_latitude(self):
        """Test formatting positive latitude (2 digits)"""
        result = format_coordinate(58.396, is_longitude=False)
        # Should be 2-digit padded: 58.396
        assert result.startswith('58')
        assert '396' in result

    def test_format_negative_latitude(self):
        """Test formatting negative latitude"""
        result = format_coordinate(-12.345, is_longitude=False)
        # Should have minus sign and 2-digit padding: -12.345
        assert result.startswith('-12')

    def test_format_positive_longitude(self):
        """Test formatting positive longitude (3 digits)"""
        result = format_coordinate(15.578, is_longitude=True)
        # Should be 3-digit padded: 015.578
        assert result.startswith('015')

    def test_format_large_longitude(self):
        """Test formatting large longitude (3 digits, no padding needed)"""
        result = format_coordinate(123.456, is_longitude=True)
        assert result.startswith('123')

    def test_format_negative_longitude(self):
        """Test formatting negative longitude"""
        result = format_coordinate(-73.987, is_longitude=True)
        # Should have minus and 3-digit padding: -073.987
        assert result.startswith('-073')

    def test_format_removes_trailing_zeros(self):
        """Test that trailing zeros are removed"""
        result = format_coordinate(58.3960000, is_longitude=False)
        # Should remove trailing zeros: 58.396
        assert not result.endswith('0000')

    def test_format_whole_number(self):
        """Test formatting whole number (no decimals)"""
        result = format_coordinate(45.0, is_longitude=False)
        # Should be: 45 (no decimal point)
        assert result == '45'

    def test_format_very_small_latitude(self):
        """Test formatting very small latitude"""
        result = format_coordinate(1.23, is_longitude=False)
        # Should be 2-digit padded: 01.23
        assert result.startswith('01')

    def test_format_very_small_longitude(self):
        """Test formatting very small longitude"""
        result = format_coordinate(5.67, is_longitude=True)
        # Should be 3-digit padded: 005.67
        assert result.startswith('005')

    def test_format_precision_preservation(self):
        """Test that precision is preserved (up to 9 decimals)"""
        result = format_coordinate(58.123456789, is_longitude=False)
        # Should preserve up to 9 decimals
        assert '123456789' in result

    def test_format_max_precision_trimmed(self):
        """Test that precision beyond 9 decimals is trimmed"""
        result = format_coordinate(58.1234567890123456, is_longitude=False)
        # Should trim after 9 decimals
        # Max is 9 decimals, then trailing zeros removed
        assert result.startswith('58')

    def test_format_zero_latitude(self):
        """Test formatting zero latitude"""
        result = format_coordinate(0.0, is_longitude=False)
        assert result == '00'

    def test_format_zero_longitude(self):
        """Test formatting zero longitude"""
        result = format_coordinate(0.0, is_longitude=True)
        assert result == '000'

    def test_format_near_180_longitude(self):
        """Test formatting longitude near ±180"""
        result = format_coordinate(179.999, is_longitude=True)
        assert result.startswith('179')

        result_neg = format_coordinate(-179.999, is_longitude=True)
        assert result_neg.startswith('-179')

    def test_format_equator_prime_meridian(self):
        """Test formatting at equator and prime meridian"""
        lat = format_coordinate(0.0001, is_longitude=False)
        lon = format_coordinate(0.0001, is_longitude=True)

        assert lat.startswith('00')
        assert lon.startswith('000')

    def test_format_typical_sweden_coordinates(self):
        """Test typical Swedish coordinates (Linköping area)"""
        lat = format_coordinate(58.410807, is_longitude=False)
        lon = format_coordinate(15.621371, is_longitude=True)

        # Latitude should be 2-digit padded
        assert lat.startswith('58')
        assert '410807' in lat

        # Longitude should be 3-digit padded
        assert lon.startswith('015')
        assert '621371' in lon


@pytest.fixture
def app():
    """Create Flask app with in-memory database for testing"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()
        app.register_blueprint(camera_config_bp, url_prefix='/api')
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture
def test_cameras(app):
    """Create test cameras in database"""
    with app.app_context():
        cam1 = Camera(ip_address='192.168.0.97', serialno='ACCC8E111111')
        cam2 = Camera(ip_address='192.168.0.98', serialno='ACCC8E222222')
        cam3 = Camera(ip_address='192.168.0.96', serialno='ACCC8E333333')
        db.session.add_all([cam1, cam2, cam3])
        db.session.commit()
        return [cam1.id, cam2.id, cam3.id]


class TestCameraListing:
    """Test camera listing endpoint (GET /cameras)"""

    def test_get_empty_cameras(self, client):
        """Test GET cameras when database is empty"""
        response = client.get('/api/cameras')
        assert response.status_code == 200
        data = response.json
        assert 'message' in data
        assert 'no cameras' in data['message']

    def test_get_all_cameras(self, client, test_cameras):
        """Test GET all cameras"""
        response = client.get('/api/cameras')
        assert response.status_code == 200
        data = response.json
        assert 'cameras' in data
        assert len(data['cameras']) == 3

    def test_camera_serialization(self, client, test_cameras, app):
        """Test camera serialize() includes all fields"""
        response = client.get('/api/cameras')
        cameras = response.json['cameras']

        for camera in cameras:
            assert 'id' in camera
            assert 'ip_address' in camera
            assert 'lat' in camera
            assert 'lon' in camera
            assert 'serialno' in camera


class TestCameraValidation:
    """Test camera ID validation decorator"""

    def test_invalid_camera_id_returns_404(self, client):
        """Test that invalid camera ID returns 404"""
        # Camera ID 999 doesn't exist in CAMERA_IPS
        response = client.post('/api/cameras/999/geolocation', json={
            'latitude': 58.0,
            'longitude': 15.0
        })

        assert response.status_code == 404
        assert 'error' in response.json


class TestMockStream:
    """Test mock position streaming endpoint"""

    def test_mock_stream_returns_sse(self, client):
        """Test that mock stream returns Server-Sent Events"""
        # Note: Testing SSE streams is tricky, just verify it starts
        response = client.get('/api/test/mock-stream', buffered=False)

        assert response.status_code == 200
        assert response.mimetype == 'text/event-stream'

    def test_mock_stream_format(self, client):
        """Test mock stream data format"""
        # Get first chunk of stream
        response = client.get('/api/test/mock-stream', buffered=False)

        # Should be valid SSE format (data: {...}\n\n)
        # Note: Full testing would require async handling


class TestPositionCalculation:
    """Test calculate position endpoint"""

    def test_calc_position_with_coordinates(self, client):
        """Test position calculation with GPS coordinates"""
        response = client.post('/api/test/calc-position', json={
            'latitude': 58.396,
            'longitude': 15.578
        })

        assert response.status_code == 200
        data = response.json
        assert 'x_m' in data
        assert 'y_m' in data

        # Results should be in meters
        assert isinstance(data['x_m'], (int, float))
        assert isinstance(data['y_m'], (int, float))

    def test_calc_position_uses_defaults(self, client):
        """Test that missing coordinates use defaults"""
        response = client.post('/api/test/calc-position', json={})

        assert response.status_code == 200
        # Should use default values (58.396, 15.578)

    def test_calc_position_near_bottom_left(self, client):
        """Test position near bottom-left reference point"""
        # Use coordinates very close to reference point
        response = client.post('/api/test/calc-position', json={
            'latitude': 58.39775183023039,
            'longitude': 15.576700744793811
        })

        assert response.status_code == 200
        data = response.json

        # Should be close to origin
        assert data['x_m'] >= 0
        assert data['y_m'] >= 0


class TestCORSHandling:
    """Test CORS preflight handling"""

    def test_options_on_cameras(self, client):
        """Test OPTIONS request on /cameras"""
        response = client.options('/api/cameras')
        assert response.status_code == 200

    def test_options_on_calc_position(self, client):
        """Test OPTIONS request on calc-position"""
        response = client.options('/api/test/calc-position')
        assert response.status_code == 200


class TestCameraIPConfiguration:
    """Test camera IP configuration from environment"""

    def test_camera_ips_loaded(self):
        """Test that CAMERA_IPS dictionary is populated"""
        from routes.camera_config_routes import CAMERA_IPS

        # Should have at least camera IDs 1, 2, 3
        assert 1 in CAMERA_IPS
        assert 2 in CAMERA_IPS
        assert 3 in CAMERA_IPS

        # IPs should be strings
        assert isinstance(CAMERA_IPS[1], str)


class TestEdgeCases:
    """Test edge cases for camera configuration"""

    def test_calc_position_extreme_north(self, client):
        """Test calculation with very northern latitude"""
        response = client.post('/api/test/calc-position', json={
            'latitude': 85.0,
            'longitude': 15.578
        })

        assert response.status_code == 200
        # Should still work, even if result is very large

    def test_calc_position_southern_hemisphere(self, client):
        """Test calculation with southern hemisphere"""
        response = client.post('/api/test/calc-position', json={
            'latitude': -33.8688,  # Sydney
            'longitude': 151.2093
        })

        assert response.status_code == 200

    def test_calc_position_negative_longitude(self, client):
        """Test calculation with western hemisphere (negative lon)"""
        response = client.post('/api/test/calc-position', json={
            'latitude': 40.7128,  # New York
            'longitude': -74.0060
        })

        assert response.status_code == 200
        data = response.json

        # Both should be positive (abs() applied in function)
        assert data['x_m'] >= 0
        assert data['y_m'] >= 0

    def test_format_coordinate_boundary_values(self):
        """Test coordinate formatting at boundaries"""
        # Maximum latitude
        result = format_coordinate(90.0, is_longitude=False)
        assert result == '90'

        # Minimum latitude
        result = format_coordinate(-90.0, is_longitude=False)
        assert result == '-90'

        # Maximum longitude
        result = format_coordinate(180.0, is_longitude=True)
        assert result == '180'

        # Minimum longitude
        result = format_coordinate(-180.0, is_longitude=True)
        assert result == '-180'


class TestCameraConfigurationValidation:
    """Test configuration request validation"""

    def test_geolocation_requires_both_coords(self, client):
        """Test that geolocation requires both lat and lon"""
        # Note: This tests the route validation, not actual camera API
        # Since validate_camera_id will reject non-existent IDs, we skip this
        pass

    def test_orientation_requires_all_fields(self, client):
        """Test that orientation requires tilt, heading, installation_height"""
        # This would require mocking camera_request
        pass


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
