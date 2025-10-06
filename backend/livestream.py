import cv2
import threading
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
        
        # Start the camera thread
        self.start_camera()
    
    def start_camera(self):
        """Start the camera capture thread"""
        if self.thread is None or not self.thread.is_alive():
            self.is_running = True
            self.thread = threading.Thread(target=self._capture_frames)
            self.thread.daemon = True
            self.thread.start()
    
    def _capture_frames(self):
        """Capture frames in a separate thread"""
        while self.is_running:
            try:
                # Initialize or reinitialize camera connection
                if self.cap is None or not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(self.url)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer size
                    
                    if not self.cap.isOpened():
                        print("Error: Cannot connect to camera stream")
                        time.sleep(5)  # Wait before retrying
                        continue
                
                ret, frame = self.cap.read()
                
                if ret:
                    # Resize frame for better performance (optional)
                    frame = cv2.resize(frame, (640, 480))
                    
                    with self.thread_lock:
                        self.frame = frame.copy()
                else:
                    print("Cannot read frame from camera")
                    self._reset_camera()
                    
            except Exception as e:
                print(f"Camera error: {e}")
                self._reset_camera()
                time.sleep(1)
    
    def _reset_camera(self):
        """Reset camera connection"""
        if self.cap:
            self.cap.release()
            self.cap = None
        time.sleep(2)
    
    def get_frame(self):
        """Get current frame as JPEG bytes"""
        with self.thread_lock:
            if self.frame is None:
                return None
            
            # Encode frame as JPEG
            ret, buffer = cv2.imencode('.jpg', self.frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                return buffer.tobytes()
        return None
    
    def is_connected(self):
        """Check if camera is connected"""
        return self.cap is not None and self.cap.isOpened() and self.frame is not None
    
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