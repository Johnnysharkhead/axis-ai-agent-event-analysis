#backend/tests/test_track_fusion.py
#Unit tests for TrackFusion class
import pytest
import time
import math
from infrastructure.track_fusion import TrackFusion


#---------------- Fixtures ----------------

#Create a fresh TrackFusion instance for each test
@pytest.fixture
def fusion():
    return TrackFusion(fusion_distance=0.5, track_timeout=3.0)

#Create a TrackFusion instance with short timeout for testing cleanup
@pytest.fixture
def fusion_short_timeout():
    return TrackFusion(fusion_distance=0.5, track_timeout=0.1)


#---------------- Track Creation Tests ----------------

#Test creating the first global track
def test_create_first_track(fusion):
    global_id = fusion.fuse_track("camera1", 5, 5.0, 3.0)

    assert global_id == "global_1"
    assert fusion.get_track_count() == 1

    position = fusion.get_track_position(global_id)
    assert position['x_m'] == 5.0
    assert position['y_m'] == 3.0

#Test creating multiple tracks for different people
def test_create_multiple_separate_tracks(fusion):
    #Person 1 at (5.0, 3.0)
    id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)

    #Person 2 at (8.0, 6.0)
    id2 = fusion.fuse_track("camera1", 7, 8.0, 6.0)

    assert id1 == "global_1"
    assert id2 == "global_2"
    assert fusion.get_track_count() == 2

    pos1 = fusion.get_track_position(id1)
    pos2 = fusion.get_track_position(id2)
    assert pos1['x_m'] == 5.0
    assert pos2['x_m'] == 8.0

#Test that global IDs increment sequentially
def test_sequential_global_ids(fusion):
    id1 = fusion.fuse_track("camera1", 1, 1.0, 1.0)
    id2 = fusion.fuse_track("camera1", 2, 5.0, 5.0)
    id3 = fusion.fuse_track("camera1", 3, 9.0, 9.0)

    assert id1 == "global_1"
    assert id2 == "global_2"
    assert id3 == "global_3"


#---------------- Track Update Tests ----------------

#Test updating position of a known camera/track combination
def test_update_existing_track(fusion):
    #Initial observation
    global_id = fusion.fuse_track("camera1", 5, 5.0, 3.0)

    #Same camera, same track - person moved
    updated_id = fusion.fuse_track("camera1", 5, 5.5, 3.5)

    assert updated_id == global_id  #Should return same global ID
    assert fusion.get_track_count() == 1  #Still only one person

    position = fusion.get_track_position(global_id)
    assert position['x_m'] == 5.5
    assert position['y_m'] == 3.5

#Test multiple position updates for the same track
def test_multiple_updates_same_track(fusion):
    global_id = fusion.fuse_track("camera1", 5, 0.0, 0.0)

    #Simulate person walking
    positions = [(1.0, 1.0), (2.0, 2.0), (3.0, 3.0)]
    for x, y in positions:
        updated_id = fusion.fuse_track("camera1", 5, x, y)
        assert updated_id == global_id

    final_pos = fusion.get_track_position(global_id)
    assert final_pos['x_m'] == 3.0
    assert final_pos['y_m'] == 3.0


#---------------- Spatial Fusion Tests ----------------

#Test that two cameras seeing same person get fused into one global track
def test_spatial_fusion_two_cameras(fusion):
    #Camera 1 sees person
    id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)

    #Camera 2 sees same person at nearby position (within 0.5m)
    id2 = fusion.fuse_track("camera2", 3, 5.1, 3.1)

    assert id1 == id2  #Should be same global ID
    assert fusion.get_track_count() == 1  #Only one person

    #Position should be averaged
    position = fusion.get_track_position(id1)
    assert abs(position['x_m'] - 5.05) < 0.01  #(5.0 + 5.1) / 2
    assert abs(position['y_m'] - 3.05) < 0.01  #(3.0 + 3.1) / 2

#Test fusion at exactly the threshold distance
def test_spatial_fusion_exact_threshold(fusion):
    id1 = fusion.fuse_track("camera1", 1, 0.0, 0.0)

    #0.49m away, should fuse 
    id2 = fusion.fuse_track("camera2", 2, 0.49, 0.0)

    assert id1 == id2
    assert fusion.get_track_count() == 1

#Test that tracks beyond fusion distance don't get merged
def test_no_fusion_beyond_threshold(fusion):
    id1 = fusion.fuse_track("camera1", 1, 0.0, 0.0)

    #0.6m away, should not fuse
    id2 = fusion.fuse_track("camera2", 2, 0.6, 0.0)

    assert id1 != id2
    assert fusion.get_track_count() == 2

#Test fusion across three cameras observing same person
def test_three_cameras_same_person(fusion):
    id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)
    id2 = fusion.fuse_track("camera2", 3, 5.1, 3.1)
    id3 = fusion.fuse_track("camera3", 7, 4.9, 2.9)

    assert id1 == id2 == id3
    assert fusion.get_track_count() == 1

#Test complex scenario with multiple people and cameras
def test_multiple_people_multiple_cameras(fusion):
    #Person 1 seen by camera 1 and 2
    p1_c1 = fusion.fuse_track("camera1", 5, 2.0, 2.0)
    p1_c2 = fusion.fuse_track("camera2", 3, 2.1, 2.1)

    #Person 2 seen by camera 1 and 3
    p2_c1 = fusion.fuse_track("camera1", 7, 8.0, 8.0)
    p2_c3 = fusion.fuse_track("camera3", 9, 8.1, 8.1)

    assert p1_c1 == p1_c2
    assert p2_c1 == p2_c3
    assert p1_c1 != p2_c1
    assert fusion.get_track_count() == 2


#---------------- Stale Track Cleanup Tests ----------------

#Test that tracks not updated within timeout get removed
def test_stale_track_cleanup(fusion_short_timeout):
    fusion = fusion_short_timeout

    #Create a track
    global_id = fusion.fuse_track("camera1", 5, 5.0, 3.0)
    assert fusion.get_track_count() == 1

    #Wait for timeout
    time.sleep(0.15)

    #Trigger cleanup by adding a new observation
    new_id = fusion.fuse_track("camera2", 7, 8.0, 8.0)

    #Old track should be cleaned up
    assert fusion.get_track_count() == 1
    assert fusion.get_track_position(global_id) is None
    assert fusion.get_track_position(new_id) is not None

#Test that recently updated tracks don't get cleaned up
def test_active_track_not_cleaned(fusion_short_timeout):
    fusion = fusion_short_timeout

    global_id = fusion.fuse_track("camera1", 5, 5.0, 3.0)

    #Keep updating before timeout
    for i in range(3):
        time.sleep(0.05)
        fusion.fuse_track("camera1", 5, 5.0 + i * 0.1, 3.0)

    assert fusion.get_track_count() == 1
    assert fusion.get_track_position(global_id) is not None

#Test that cleanup removes camera-to-global mappings
def test_cleanup_removes_camera_mappings(fusion_short_timeout):
    fusion = fusion_short_timeout

    #Create track with two cameras
    id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)
    id2 = fusion.fuse_track("camera2", 3, 5.1, 3.1)
    assert id1 == id2

    #Wait for cleanup
    time.sleep(0.15)

    #Trigger cleanup
    fusion.fuse_track("camera3", 9, 8.0, 8.0)

    #Try to use old camera tracks - should create new global tracks
    new_id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)
    new_id2 = fusion.fuse_track("camera2", 3, 5.0, 3.0)

    #Should fuse together as new track
    assert new_id1 == new_id2
    assert new_id1 != id1  #Different from original cleaned-up track


#---------------- Distance Calculation Tests ----------------

#Test distance calculation for axis-aligned points
def test_distance_calculation_axis_aligned(fusion):
    #Points 3m apart on x-axis
    id1 = fusion.fuse_track("camera1", 1, 0.0, 0.0)
    id2 = fusion.fuse_track("camera2", 2, 3.0, 0.0)

    assert id1 != id2  #3m > 0.5m threshold
    assert fusion.get_track_count() == 2

#Test distance calculation for diagonal points
def test_distance_calculation_diagonal(fusion):
    #Pythagorean: sqrt(0.3^2 + 0.4^2) = 0.5m exactly
    #Note: fusion uses < not <=, so exactly 0.5m won't fuse
    id1 = fusion.fuse_track("camera1", 1, 0.0, 0.0)
    id2 = fusion.fuse_track("camera2", 2, 0.3, 0.4)

    #Should not fuse
    assert id1 != id2
    assert fusion.get_track_count() == 2

    #Test just under threshold
    id3 = fusion.fuse_track("camera3", 3, 0.28, 0.36)
    #Should fuse with id1
    assert id3 == id1
    assert fusion.get_track_count() == 2


#---------------- Position Averaging Tests ----------------

#Test that fused positions are averaged correctly
def test_position_averaging_simple(fusion):
    #Positions within 0.5m: distance = sqrt(0.2^2 + 0.2^2) = 0.283m
    id1 = fusion.fuse_track("camera1", 5, 4.0, 2.0)
    id2 = fusion.fuse_track("camera2", 3, 4.2, 2.2)

    assert id1 == id2

    position = fusion.get_track_position(id1)
    assert abs(position['x_m'] - 4.1) < 0.01  #(4.0 + 4.2) / 2
    assert abs(position['y_m'] - 2.1) < 0.01  #(2.0 + 2.2) / 2

#Test averaging with unequal initial values
def test_position_averaging_asymmetric(fusion):
    id1 = fusion.fuse_track("camera1", 5, 1.0, 1.0)
    id2 = fusion.fuse_track("camera2", 3, 1.2, 1.4)

    position = fusion.get_track_position(id1)
    assert abs(position['x_m'] - 1.1) < 0.01  #(1.0 + 1.2) / 2
    assert abs(position['y_m'] - 1.2) < 0.01  #(1.0 + 1.4) / 2


#---------------- API Method Tests ----------------

#Test getting position of non-existent track returns None
def test_get_track_position_nonexistent(fusion):
    position = fusion.get_track_position("global_999")
    assert position is None

#Test getting all active tracks
def test_get_active_tracks(fusion):
    id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)
    id2 = fusion.fuse_track("camera1", 7, 8.0, 6.0)

    tracks = fusion.get_active_tracks()

    assert len(tracks) == 2
    assert id1 in tracks
    assert id2 in tracks
    assert tracks[id1]['x_m'] == 5.0
    assert tracks[id2]['x_m'] == 8.0

#Test getting active tracks when none exist
def test_get_active_tracks_empty(fusion):
    tracks = fusion.get_active_tracks()
    assert tracks == {}

#Test track counting
def test_get_track_count(fusion):
    assert fusion.get_track_count() == 0

    fusion.fuse_track("camera1", 5, 5.0, 3.0)
    assert fusion.get_track_count() == 1

    fusion.fuse_track("camera1", 7, 8.0, 6.0)
    assert fusion.get_track_count() == 2

    #Same person seen by different camera, count shouldn't increase
    fusion.fuse_track("camera2", 3, 5.1, 3.1)
    assert fusion.get_track_count() == 2

#Test that reset clears all state
def test_reset(fusion):
    #Add some tracks
    fusion.fuse_track("camera1", 5, 5.0, 3.0)
    fusion.fuse_track("camera2", 3, 5.1, 3.1)
    fusion.fuse_track("camera1", 7, 8.0, 6.0)

    assert fusion.get_track_count() == 2

    #Reset
    fusion.reset()

    assert fusion.get_track_count() == 0
    assert fusion.get_active_tracks() == {}

    #Should start from global_1 again
    new_id = fusion.fuse_track("camera1", 5, 1.0, 1.0)
    assert new_id == "global_1"


#---------------- Configuration Tests ----------------

#Test creating TrackFusion with custom fusion distance
def test_custom_fusion_distance():
    fusion = TrackFusion(fusion_distance=1.0)  #Larger threshold

    id1 = fusion.fuse_track("camera1", 1, 0.0, 0.0)
    id2 = fusion.fuse_track("camera2", 2, 0.8, 0.0)

    #0.8m should fuse with 1.0m threshold (but not with default 0.5m)
    assert id1 == id2

#Test creating TrackFusion with custom timeout
def test_custom_track_timeout():
    fusion = TrackFusion(track_timeout=0.05)  #Very short timeout

    global_id = fusion.fuse_track("camera1", 5, 5.0, 3.0)

    time.sleep(0.1)

    #Trigger cleanup
    fusion.fuse_track("camera2", 7, 8.0, 8.0)

    #Old track should be gone
    assert fusion.get_track_position(global_id) is None


#---------------- Edge Case Tests ----------------

#Test same camera seeing two people close together
def test_same_camera_different_tracks_nearby(fusion):
    #Single camera sees two people 0.4m apart
    id1 = fusion.fuse_track("camera1", 5, 5.0, 3.0)
    id2 = fusion.fuse_track("camera1", 7, 5.3, 3.2)

    #Distance is ~0.36m, which is < 0.5m threshold
    #They should be fused since spatially close
    assert id1 == id2
    assert fusion.get_track_count() == 1

#Test handling position at origin
def test_zero_position(fusion):
    global_id = fusion.fuse_track("camera1", 5, 0.0, 0.0)

    position = fusion.get_track_position(global_id)
    assert position['x_m'] == 0.0
    assert position['y_m'] == 0.0

#Test handling negative coordinates
def test_negative_positions(fusion):
    global_id = fusion.fuse_track("camera1", 5, -5.0, -3.0)

    position = fusion.get_track_position(global_id)
    assert position['x_m'] == -5.0
    assert position['y_m'] == -3.0

#Test handling large track IDs
def test_large_track_ids(fusion):
    global_id = fusion.fuse_track("camera1", 999999, 5.0, 3.0)

    assert global_id == "global_1"
    position = fusion.get_track_position(global_id)
    assert position is not None

#Test handling various camera ID formats
def test_string_camera_ids(fusion):
    #IP address
    id1 = fusion.fuse_track("192.168.0.97", 5, 5.0, 3.0)

    #Alphanumeric
    id2 = fusion.fuse_track("AXIS_CAM_01", 3, 5.1, 3.1)

    #Should fuse based on position
    assert id1 == id2


#---------------- Performance Tests ----------------

#Test handling many simultaneous tracks
def test_many_tracks_performance(fusion):
    #Create 100 separate tracks
    for i in range(100):
        x = i * 2.0  #Spread out by 2m each
        global_id = fusion.fuse_track("camera1", i, x, 0.0)
        assert global_id == f"global_{i + 1}"

    assert fusion.get_track_count() == 100

#Test many cameras observing the same person
def test_many_cameras_same_person(fusion):
    #10 cameras all see same person at slightly different positions
    global_ids = []
    for i in range(10):
        #All within 0.5m of origin
        x = 0.0 + (i * 0.05)
        y = 0.0 + (i * 0.03)
        global_id = fusion.fuse_track(f"camera{i}", i, x, y)
        global_ids.append(global_id)

    #All should be fused to same global track
    assert len(set(global_ids)) == 1
    assert fusion.get_track_count() == 1