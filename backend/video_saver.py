import os
import subprocess
import threading
import time
from datetime import datetime

class RecordingManager:
    def __init__(self):
        self.process = None
        self.output_path = None
        self.recording = False
        self.recording_thread = None
        self.recording_dir = None
        self.output_root = None
        self.process_lock = threading.Lock()

    def is_recording(self):
        """Check if a recording is currently active."""
        return self.recording

    def start_recording(self, rtsp_url, output_dir="recordings"):
        """Start capturing the RTSP stream and save it as an HLS playlist."""
        if self.is_recording():
            print("A recording is already in progress.")
            return False, "A recording is already in progress."

        os.makedirs(output_dir, exist_ok=True)
        
        vers = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        print(vers.stdout)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        recording_folder_name = f"recording_{timestamp}"
        self.output_root = output_dir
        self.recording_dir = os.path.join(output_dir, recording_folder_name)
        os.makedirs(self.recording_dir, exist_ok=True)

        playlist_path = os.path.join(self.recording_dir, "playlist.m3u8")
        segment_pattern = os.path.join(self.recording_dir, "segment%03d.ts")

        command = [
            "ffmpeg",
            "-rtsp_transport",
            "tcp",
            "-i",
            rtsp_url,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-preset",
            "veryfast",
            "-hls_time",
            "4",
            "-hls_list_size",
            "0",
            "-hls_flags",
            "independent_segments",
            "-hls_segment_filename",
            segment_pattern,
            "-f",
            "hls",
            "-y",
            playlist_path,
        ]

        print("Starting HLS recording with FFmpeg...")

        try:
            self.process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
        except FileNotFoundError:
            error_msg = "ffmpeg executable not found. Please install ffmpeg on the server."
            print(error_msg)
            self._cleanup()
            return False, error_msg
        except Exception as exc:
            error_msg = f"Failed to start ffmpeg for HLS recording: {exc}"
            print(error_msg)
            self._cleanup()
            return False, error_msg

        # Give FFmpeg a moment to initialize
        time.sleep(1.0)
        if self.process.poll() is not None:
            error_msg = f"ffmpeg exited unexpectedly with code {self.process.returncode}"
            print(error_msg)
            self._cleanup()
            return False, error_msg

        self.recording = True
        self.output_path = playlist_path

        # Start a watcher thread to log process exit
        self.recording_thread = threading.Thread(target=self._watch_process, daemon=True)
        self.recording_thread.start()

        relative_playlist = os.path.join(recording_folder_name, "playlist.m3u8")
        print(f"Recording started. HLS playlist at {relative_playlist}")
        return True, relative_playlist

    def _watch_process(self):
        """Monitor the FFmpeg process and clean up when it exits."""
        with self.process_lock:
            process = self.process

        if not process:
            return

        process.wait()
        if self.recording:
            print("FFmpeg process ended unexpectedly, stopping recording.")
        else:
            print("FFmpeg process finished.")
        with self.process_lock:
            self._cleanup()

    def stop_recording(self):
        """Stops the current recording."""
        if not self.is_recording():
            print("No recording is currently in progress.")
            return False, "No recording is in progress."

        print("Stopping recording...")
        self.recording = False

        with self.process_lock:
            if self.process and self.process.poll() is None:
                try:
                    if self.process.stdin:
                        self.process.stdin.write(b"q")
                        self.process.stdin.flush()
                    self.process.wait(timeout=10)
                except Exception as exc:
                    print(f"Error while stopping ffmpeg gracefully: {exc}")
                    self.process.terminate()
                    self.process.wait(timeout=5)

        if self.recording_thread and self.recording_thread.is_alive():
            self.recording_thread.join(timeout=5)

        final_path = None
        if self.output_path and os.path.exists(self.output_path):
            final_path = self.output_path

        relative_path = None
        if final_path and self.output_root:
            relative_path = os.path.relpath(final_path, self.output_root)

        message_path = relative_path if relative_path else final_path
        with self.process_lock:
            self._cleanup()

        if message_path:
            return True, f"Recording stopped: {message_path}"
        return True, "Recording stopped, but no playlist was created."

    def _cleanup(self):
        """Clean up resources."""
        self.recording = False

        if self.process and self.process.poll() is None:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                pass

        self.process = None
        self.recording_thread = None

        if self.output_path and os.path.exists(self.output_path):
            try:
                file_size = os.path.getsize(self.output_path)
                print(f"HLS playlist saved: {self.output_path} ({file_size} bytes)")
            except OSError:
                print(f"HLS playlist saved: {self.output_path}")

        self.recording_dir = None
        self.output_root = None
        self.output_path = None

# Create a single instance of the manager to be used by the app
recording_manager = RecordingManager()