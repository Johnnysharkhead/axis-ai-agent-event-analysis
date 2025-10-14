import cv2
import threading
import logging
import time
import psutil
import os

class VideoCamera:
    def __init__(self, camera_ip):
        # Replace with your Axis camera info
        self.username = os.getenv("camera_login", "student")
        self.password = os.getenv("camera_password", "student")
        self.ip = camera_ip
        
        # RTSP URL (Axis standard format)
        self.url = f"rtsp://{self.username}:{self.password}@{self.ip}/axis-media/media.amp"
        
        self.cap = None
        self.frame = None
        self.thread = None
        self.thread_lock = threading.Lock()
        self.is_running = False
        self.last_error = None
        self.logger = logging.getLogger(f"VideoCamera[{self.ip}]")
        self.retry_delay = 1

        # Encoding related
        self.encoded_frame = None
        self.encoding_timestamp = 0
        
        # Camera priority attributes
        self.is_primary = False
        self.quality = 75  # Default quality
        self.skip_factor = 2  # Default skip factor
        
        # Stream control
        self.paused = False  # Stream by default
        self.needs_reset = False  # Flag for camera reset requests
        
        # Start the camera thread
        self.start_camera()

    def start_camera(self):
        """Start the camera capture thread"""
        if self.thread is None or not self.thread.is_alive():
            self.is_running = True
            self.thread = threading.Thread(
                target=self._capture_frames,
                name=f"Camera-{self.ip}",
                daemon=True
            )
            self.thread.start()

    def _open_stream(self):
        """Open the camera stream with optimized settings"""
        import os
        
        if self.cap:
            self.cap.release()
        self.cap = None
        
        try:
            # Set RTSP over TCP for more reliable streaming
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            
            # Open stream with FFMPEG backend
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
            
            # Critical settings for reducing latency
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Set lower resolution directly from source if possible
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            
        except cv2.error as err:
            self.last_error = f"OpenCV init failed: {err}"
            self.logger.warning(self.last_error)
            return False
            
        if not cap.isOpened():
            self.last_error = "Stream unreachable"
            self.logger.warning("Could not open %s; retrying in %ss", self.url, self.retry_delay)
            cap.release()
            return False
            
        self.logger.info("Connected to %s", self.ip)
        self.cap = cap
        self.last_error = None
        self.retry_delay = 1
        return True

    def _capture_frames(self):
        """Capture frames in a separate thread"""
        last_reset_time = time.time()
        skip_counter = 0
        
        while self.is_running:
            # Handle camera reset requests from other threads
            if self.needs_reset:
                self._reset_camera()
                # Clear the flag first to prevent infinite reset loops
                self.needs_reset = False
                if not self._open_stream():
                    time.sleep(1)
                    continue
            
            # Use a local copy of paused flag to avoid race conditions
            is_paused = self.paused
            
            # Skip all processing if paused
            if is_paused:
                time.sleep(0.2)  # Sleep longer when paused to save resources
                continue
                
            # Always check if camera is valid before any operation
            with self.thread_lock:
                has_valid_camera = self.cap is not None and self.cap.isOpened()
                
            if not has_valid_camera:
                if not self._open_stream():
                    time.sleep(self.retry_delay)
                    self.retry_delay = min(self.retry_delay * 2, 30)
                    continue
            
            # Connection reset logic
            current_time = time.time()
            if current_time - last_reset_time > 300:  # 5 minutes
                self._reset_camera()
                last_reset_time = current_time
                if not self._open_stream():
                    continue
    
            # Frame skipping based on priority
            skip_counter += 1
            if skip_counter % self.skip_factor != 0:
                try:
                    ok = self.cap.grab()
                    if not ok:
                        self._reset_camera()
                        continue
                except Exception as e:
                    self.logger.error(f"Error during frame grab: {str(e)}")
                    self._reset_camera()
                    continue
                continue
                
            # Read and process frame
            try:
                ok, frame = self.cap.read()
                if not ok:
                    self.last_error = "Frame grab failed"
                    time.sleep(0.1)
                    continue
            except Exception as e:
                self.logger.error(f"Error during frame read: {str(e)}")
                self._reset_camera()
                time.sleep(0.1)
                continue
            
            # Only resize if truly necessary
            try:
                h, w = frame.shape[:2]
                if abs(w - 640) > 100 or abs(h - 480) > 100:
                    frame = cv2.resize(frame, (640, 480), interpolation=cv2.INTER_NEAREST)
            except Exception as e:
                self.logger.error(f"Error during resize: {str(e)}")
                continue
            
            # Use quality from priority setting
            try:
                ok, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, self.quality])
                if ok:
                    with self.thread_lock:
                        self.frame = frame
                        self.encoded_frame = buffer.tobytes()
                        self.encoding_timestamp = time.time()
            except Exception as e:
                self.logger.error(f"Error during encoding: {str(e)}")
                continue
        
            # Small sleep
            time.sleep(0.001)

            # Resource monitoring
            if skip_counter % 30 == 0:  # Check every 30 frames
                # Check system resources
                try:
                    cpu_percent = psutil.cpu_percent()
                    mem_percent = psutil.virtual_memory().percent
                    
                    # Adjust quality and skip factor based on resource usage
                    if cpu_percent > 80 or mem_percent > 85:  # High resource usage
                        if not self.is_primary:
                            self.quality = max(50, self.quality - 5)  # Reduce quality
                            self.skip_factor = min(8, self.skip_factor + 1)  # Skip more frames
                    elif cpu_percent < 60 and mem_percent < 70:  # Low resource usage
                        # Restore default settings
                        self.quality = 80 if self.is_primary else 65
                        self.skip_factor = 2 if self.is_primary else 4
                except Exception as e:
                    self.logger.error(f"Error during resource monitoring: {str(e)}")

    def _reset_camera(self):
        """Reset camera connection"""
        try:
            if self.cap:
                self.cap.release()
        except Exception as e:
            self.logger.error(f"Error releasing camera: {str(e)}")
        self.cap = None

    def get_frame(self):
        """Get current frame as JPEG bytes"""
        with self.thread_lock:
            if self.encoded_frame is None:
                return None
            return self.encoded_frame

    def is_connected(self):
        """Check if camera is connected"""
        return self.cap is not None and self.cap.isOpened() and self.frame is not None
    
    def status(self):
        """Get camera status"""
        status_info = {
            "ip": self.ip, 
            "connected": self.is_connected(), 
            "error": self.last_error,
            "active": not self.paused,
            "is_primary": self.is_primary
        }
        return status_info
    
    def pause_streaming(self):
        """Pause streaming from this camera"""
        self.paused = True
        self.logger.info(f"Camera {self.ip} streaming paused")
    
    def resume_streaming(self):
        """Resume streaming from this camera - safer implementation"""
        # Just set the flag and let the capture thread handle reconnection
        self.paused = False
        self.needs_reset = True
        self.logger.info(f"Camera {self.ip} streaming resumed")
    
    def set_priority(self, is_primary):
        """Set this camera as primary or secondary"""
        self.is_primary = is_primary
        self.quality = 80 if is_primary else 65  # Higher quality for primary camera
        self.skip_factor = 2 if is_primary else 4  # Skip more frames for non-primary
        
        # Safer way to control camera state
        if is_primary:
            self.paused = False
            self.needs_reset = True
        else:
            self.paused = True
            
        self.logger.info(f"Camera {self.ip} priority set to: {'primary' if is_primary else 'secondary'}")
    
    def stop(self):
        """Stop the camera capture"""
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)  # Wait for thread to finish with timeout
        self._reset_camera()  # Make sure camera is released
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop()