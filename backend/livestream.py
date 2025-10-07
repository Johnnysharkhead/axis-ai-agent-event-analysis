import cv2
import threading
import logging
import time

class VideoCamera:
    def __init__(self, camera_ip):
        # Replace with your Axis camera info
        self.username = "student"
        self.password = "student"
        self.ip = camera_ip   # Camera IP
        
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
        """Open the camera stream"""
        if self.cap:
            self.cap.release()
        self.cap = None
        try:
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
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
        while self.is_running:
            if self.cap is None or not self.cap.isOpened():
                if not self._open_stream():
                    time.sleep(self.retry_delay)
                    self.retry_delay = min(self.retry_delay * 2, 30)
                    continue
            ok, frame = self.cap.read()
            if not ok:
                self.last_error = "Frame grab failed"
                self.logger.debug("Frame read failed for %s; resetting", self.ip)
                self._reset_camera()
                continue
            frame = cv2.resize(frame, (640, 480))
            with self.thread_lock:
                self.frame = frame.copy()

    def _reset_camera(self):
        """Reset camera connection"""
        if self.cap:
            self.cap.release()
        self.cap = None

    def get_frame(self):
        """Get current frame as JPEG bytes"""
        with self.thread_lock:
            if self.frame is None:
                return None
            ok, buffer = cv2.imencode('.jpg', self.frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                self.last_error = "JPEG encode failed"
                return None
            return buffer.tobytes()

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
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop()