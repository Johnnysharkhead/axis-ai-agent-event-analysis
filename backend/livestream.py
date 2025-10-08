import cv2
import threading
import logging
import time
import psutil  # Add this import at the top

class VideoCamera:
    def __init__(self, camera_ip):
        # Replace with your Axis camera info
        self.username = "student"
        self.password = "student"
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
        
        # Additional attributes
        self.is_primary = False
        self.quality = 75  # Default quality
        self.skip_factor = 2  # Default skip factor

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
            # Connection reset logic (unchanged)
            current_time = time.time()
            if current_time - last_reset_time > 300:
                self._reset_camera()
                last_reset_time = current_time
                
            # Ensure connection (unchanged)
            if self.cap is None or not self.cap.isOpened():
                if not self._open_stream():
                    time.sleep(self.retry_delay)
                    self.retry_delay = min(self.retry_delay * 2, 30)
                    continue
        
            # Frame skipping based on priority
            skip_counter += 1
            if skip_counter % self.skip_factor != 0:  # Use skip_factor instead of fixed value
                ok = self.cap.grab()
                if not ok:
                    self._reset_camera()
                    continue
                continue
                
            # Read and process frame (unchanged)
            ok, frame = self.cap.read()
            if not ok:
                self.last_error = "Frame grab failed"
                time.sleep(0.1)
                continue
            
            # Only resize if truly necessary
            h, w = frame.shape[:2]
            if abs(w - 640) > 100 or abs(h - 480) > 100:
                frame = cv2.resize(frame, (640, 480), interpolation=cv2.INTER_NEAREST)
            
            # Use quality from priority setting
            ok, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, self.quality])
            if ok:
                with self.thread_lock:
                    self.frame = frame
                    self.encoded_frame = buffer.tobytes()
                    self.encoding_timestamp = time.time()
        
            # Small sleep (unchanged)
            time.sleep(0.001)

            # Add this check periodically in the loop
            if skip_counter % 30 == 0:  # Check every 30 frames
                # Check system resources
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

    def _reset_camera(self):
        """Reset camera connection"""
        if self.cap:
            self.cap.release()
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
        return {"ip": self.ip, "connected": self.is_connected(), "error": self.last_error}
    
    def stop(self):
        """Stop the camera capture"""
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join()
        if self.cap:
            self.cap.release()
    
    def set_priority(self, is_primary):
        """Set this camera as primary or secondary"""
        self.is_primary = is_primary
        self.quality = 80 if is_primary else 65  # Higher quality for primary camera
        self.skip_factor = 2 if is_primary else 4  # Skip more frames for non-primary
        self.logger.info(f"Camera {self.ip} priority set to: {'primary' if is_primary else 'secondary'}")

    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop()