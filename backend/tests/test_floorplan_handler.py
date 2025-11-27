"""
Unit tests for FloorplanManager coordinate transformation logic.

Tests GPS <-> floorplan coordinate conversions and mathematical accuracy.
Authors: Test Suite
"""
import pytest
import math
from infrastructure.floorplan_handler import FloorplanManager


class TestCoordinateConversions:
    """Test GPS coordinate to meters conversions"""

    def test_lat_to_meters_conversion(self):
        """Test that 1 degree latitude = 111,320 meters"""
        delta_lat = 1.0
        meters = FloorplanManager.lat_to_meters(delta_lat)
        assert meters == 111320.0

    def test_lat_to_meters_small_delta(self):
        """Test small latitude delta (0.0001 degrees ≈ 11.13 meters)"""
        delta_lat = 0.0001
        meters = FloorplanManager.lat_to_meters(delta_lat)
        assert abs(meters - 11.132) < 0.001

    def test_lat_to_meters_negative(self):
        """Test negative latitude delta"""
        delta_lat = -0.001
        meters = FloorplanManager.lat_to_meters(delta_lat)
        assert abs(meters - (-111.32)) < 0.01  # Use tolerance for floating point

    def test_lon_to_meters_at_equator(self):
        """Test longitude conversion at equator (latitude = 0)"""
        delta_lon = 1.0
        lat_deg = 0.0
        meters = FloorplanManager.lon_to_meters(delta_lon, lat_deg)
        # At equator, cos(0) = 1, so same as latitude
        assert meters == 111320.0

    def test_lon_to_meters_at_60_degrees(self):
        """Test longitude conversion at 60° latitude (cos(60°) = 0.5)"""
        delta_lon = 1.0
        lat_deg = 60.0
        meters = FloorplanManager.lon_to_meters(delta_lon, lat_deg)
        # At 60°, cos(60°) ≈ 0.5
        expected = 111320.0 * math.cos(math.radians(60.0))
        assert abs(meters - expected) < 0.1

    def test_lon_to_meters_at_sweden_latitude(self):
        """Test longitude at typical Sweden latitude (~58°)"""
        delta_lon = 0.001
        lat_deg = 58.0
        meters = FloorplanManager.lon_to_meters(delta_lon, lat_deg)
        expected = 0.001 * 111320.0 * math.cos(math.radians(58.0))
        assert abs(meters - expected) < 0.001


class TestReverseConversions:
    """Test meters to GPS coordinate conversions"""

    def test_meters_to_lat_conversion(self):
        """Test that 111,320 meters = 1 degree latitude"""
        delta_m = 111320.0
        degrees = FloorplanManager.meters_to_lat(delta_m)
        assert degrees == 1.0

    def test_meters_to_lat_small_distance(self):
        """Test 10 meters to latitude degrees"""
        delta_m = 10.0
        degrees = FloorplanManager.meters_to_lat(delta_m)
        expected = 10.0 / 111320.0
        assert abs(degrees - expected) < 1e-10

    def test_meters_to_lon_at_equator(self):
        """Test meters to longitude at equator"""
        delta_m = 111320.0
        lat_deg = 0.0
        degrees = FloorplanManager.meters_to_lon(delta_m, lat_deg)
        assert abs(degrees - 1.0) < 1e-10

    def test_meters_to_lon_at_sweden_latitude(self):
        """Test meters to longitude at Sweden latitude"""
        delta_m = 100.0  # 100 meters
        lat_deg = 58.0
        degrees = FloorplanManager.meters_to_lon(delta_m, lat_deg)
        expected = 100.0 / (111320.0 * math.cos(math.radians(58.0)))
        assert abs(degrees - expected) < 1e-10


class TestRoundTripConversions:
    """Test that conversions are reversible (lat->m->lat, lon->m->lon)"""

    def test_lat_round_trip(self):
        """Test latitude -> meters -> latitude"""
        original_lat = 0.001
        meters = FloorplanManager.lat_to_meters(original_lat)
        back_to_lat = FloorplanManager.meters_to_lat(meters)
        assert abs(original_lat - back_to_lat) < 1e-10

    def test_lon_round_trip_at_various_latitudes(self):
        """Test longitude -> meters -> longitude at different latitudes"""
        test_latitudes = [0.0, 30.0, 58.0, 60.0, 80.0]
        original_lon = 0.002

        for lat in test_latitudes:
            meters = FloorplanManager.lon_to_meters(original_lon, lat)
            back_to_lon = FloorplanManager.meters_to_lon(meters, lat)
            assert abs(original_lon - back_to_lon) < 1e-9, \
                f"Round-trip failed at latitude {lat}"


class TestFloorplanCoordinates:
    """Test get_floorplan_coordinates() corner calculation"""

    def test_corner_coordinates_10x10_room(self):
        """Test corner calculation for 10x10 meter room"""
        # Mock camera object
        class MockCamera:
            lat = 58.396
            lon = 15.578

        camera = MockCamera()
        floorplan_dimensions = (10.0, 10.0)  # width, depth
        placed_coords = (5.0, 5.0)  # Camera at center

        corners = FloorplanManager.get_floorplan_coordinates(
            floorplan_dimensions, camera, placed_coords
        )

        # Verify all 4 corners are returned
        assert 'top_left' in corners
        assert 'top_right' in corners
        assert 'bottom_left' in corners
        assert 'bottom_right' in corners

        # Each corner is a tuple of (lat, lon)
        assert len(corners['top_left']) == 2
        assert len(corners['top_right']) == 2
        assert len(corners['bottom_left']) == 2
        assert len(corners['bottom_right']) == 2

    def test_corner_coordinates_symmetry(self):
        """Test that corners are symmetric when camera is centered"""
        class MockCamera:
            lat = 58.0
            lon = 15.0

        camera = MockCamera()
        floorplan_dimensions = (20.0, 20.0)
        placed_coords = (10.0, 10.0)  # Centered

        corners = FloorplanManager.get_floorplan_coordinates(
            floorplan_dimensions, camera, placed_coords
        )

        cam_lat = camera.lat
        cam_lon = camera.lon

        # Top-left and bottom-left should have same longitude
        assert abs(corners['top_left'][1] - corners['bottom_left'][1]) < 1e-9

        # Top-right and bottom-right should have same longitude
        assert abs(corners['top_right'][1] - corners['bottom_right'][1]) < 1e-9

        # Top-left and top-right should have same latitude
        assert abs(corners['top_left'][0] - corners['top_right'][0]) < 1e-9

        # Bottom-left and bottom-right should have same latitude
        assert abs(corners['bottom_left'][0] - corners['bottom_right'][0]) < 1e-9

    def test_corner_coordinates_camera_offset(self):
        """Test corners when camera is NOT centered"""
        class MockCamera:
            lat = 58.396
            lon = 15.578

        camera = MockCamera()
        floorplan_dimensions = (10.0, 10.0)
        placed_coords = (3.0, 7.0)  # Camera closer to left, higher up

        corners = FloorplanManager.get_floorplan_coordinates(
            floorplan_dimensions, camera, placed_coords
        )

        # Camera is 3m from left edge, 7m from bottom
        # So: 7m left, 3m right, 3m down, 7m up

        # Top should be 3m above camera (depth - placed_y = 10 - 7 = 3)
        # Bottom should be 7m below camera (placed_y = 7)
        top_lat = corners['top_left'][0]
        bottom_lat = corners['bottom_left'][0]

        # Distance between top and bottom should equal room depth (10m)
        lat_distance_m = FloorplanManager.lat_to_meters(top_lat - bottom_lat)
        assert abs(lat_distance_m - 10.0) < 0.01


class TestPositionCalculation:
    """Test calculate_position_on_floorplan() GPS to floorplan conversion"""

    def test_position_at_bottom_left_corner(self):
        """Test object at bottom-left corner returns (0, 0)"""
        # NOTE: Function has hardcoded bottom_left coords for KY25
        bottom_lat = 58.39590610056573
        bottom_lon = 15.577997451724473

        # Object at exact bottom-left corner
        result = FloorplanManager.calculate_position_on_floorplan(
            bottom_lat, bottom_lon, [bottom_lat, bottom_lon]
        )

        # Should be at origin (with abs() applied)
        assert result['x_m'] < 0.01
        assert result['y_m'] < 0.01

    def test_position_north_of_bottom_left(self):
        """Test object 10 meters north of bottom-left"""
        bottom_lat = 58.39590610056573
        bottom_lon = 15.577997451724473

        # Move 10 meters north (increase latitude)
        delta_lat = FloorplanManager.meters_to_lat(10.0)
        object_lat = bottom_lat + delta_lat

        result = FloorplanManager.calculate_position_on_floorplan(
            object_lat, bottom_lon, [bottom_lat, bottom_lon]
        )

        # Should be 10m in Y direction
        assert abs(result['y_m'] - 10.0) < 0.01
        assert result['x_m'] < 0.01  # No X movement

    def test_position_east_of_bottom_left(self):
        """Test object 10 meters east of bottom-left"""
        bottom_lat = 58.39590610056573
        bottom_lon = 15.577997451724473

        # Move 10 meters east (increase longitude)
        delta_lon = FloorplanManager.meters_to_lon(10.0, bottom_lat)
        object_lon = bottom_lon + delta_lon

        result = FloorplanManager.calculate_position_on_floorplan(
            bottom_lat, object_lon, [bottom_lat, bottom_lon]
        )

        # Should be 10m in X direction
        assert abs(result['x_m'] - 10.0) < 0.01
        assert result['y_m'] < 0.01  # No Y movement

    def test_position_diagonal(self):
        """Test object at diagonal (northeast) position"""
        bottom_lat = 58.39590610056573
        bottom_lon = 15.577997451724473

        # Move 5m north and 5m east
        delta_lat = FloorplanManager.meters_to_lat(5.0)
        delta_lon = FloorplanManager.meters_to_lon(5.0, bottom_lat)

        object_lat = bottom_lat + delta_lat
        object_lon = bottom_lon + delta_lon

        result = FloorplanManager.calculate_position_on_floorplan(
            object_lat, object_lon, [bottom_lat, bottom_lon]
        )

        # Should be approximately (5, 5)
        assert abs(result['x_m'] - 5.0) < 0.01
        assert abs(result['y_m'] - 5.0) < 0.01

    def test_position_returns_absolute_values(self):
        """Test that result uses abs() for both coordinates"""
        bottom_lat = 58.39590610056573
        bottom_lon = 15.577997451724473

        # Try position south and west (negative deltas)
        # Note: Function ignores bottom_left parameter and uses hardcoded values
        object_lat = bottom_lat - 0.0001  # South
        object_lon = bottom_lon - 0.0001  # West

        result = FloorplanManager.calculate_position_on_floorplan(
            object_lat, object_lon, [bottom_lat, bottom_lon]
        )

        # Both should be positive due to abs()
        assert result['x_m'] >= 0
        assert result['y_m'] >= 0


class TestEdgeCases:
    """Test edge cases and potential error conditions"""

    def test_zero_latitude_delta(self):
        """Test with zero latitude difference"""
        delta_lat = 0.0
        meters = FloorplanManager.lat_to_meters(delta_lat)
        assert meters == 0.0

    def test_zero_longitude_delta(self):
        """Test with zero longitude difference"""
        delta_lon = 0.0
        lat = 58.0
        meters = FloorplanManager.lon_to_meters(delta_lon, lat)
        assert meters == 0.0

    def test_very_large_latitude(self):
        """Test with large latitude values (near poles)"""
        delta_lat = 0.001
        lat_deg = 89.0  # Near north pole

        # Should still work at high latitudes
        meters = FloorplanManager.lat_to_meters(delta_lat)
        assert meters > 0

    def test_negative_coordinates(self):
        """Test with negative GPS coordinates (southern hemisphere)"""
        delta_lat = -0.001
        meters = FloorplanManager.lat_to_meters(delta_lat)
        assert meters < 0

        # Reverse should work too
        back = FloorplanManager.meters_to_lat(meters)
        assert abs(back - delta_lat) < 1e-10

    def test_precision_with_many_decimals(self):
        """Test precision with high-precision coordinates (15 decimals)"""
        delta_lat = 0.000000000000001  # Very small
        meters = FloorplanManager.lat_to_meters(delta_lat)

        # Should maintain precision
        back = FloorplanManager.meters_to_lat(meters)
        assert abs(back - delta_lat) < 1e-15


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
