#!/usr/bin/env python3
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os

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

# Example route
@app.route("/")
def index():
    return "Hello from Flask with an auto-created DB!"

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # creates tables if they don’t exist
    app.run(host="0.0.0.0", port=backend_port)
