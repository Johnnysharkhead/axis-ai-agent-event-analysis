#!/usr/bin/env python3
from flask import Flask, Response
from flask_sqlalchemy import SQLAlchemy
import os
from livestream import VideoCamera

app = Flask(__name__)

# Ensure instance/ folder exists
os.makedirs(app.instance_path, exist_ok=True)

# Use variable from .env for port (default 5001)
backend_port = int(os.getenv("BACKEND_PORT", 5001))

# Configure SQLite database inside instance/
db_path = os.path.join(app.instance_path, "database.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

camera = VideoCamera()

def generate_frames():
    """Generate frames for the video stream"""
    while True:
        frame = camera.get_frame()
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

# Example route
@app.route("/")
def index():
    return "Hello from Flask with an auto-created DB!"


@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # creates tables if they don’t exist
    app.run(host="0.0.0.0", port=backend_port)
