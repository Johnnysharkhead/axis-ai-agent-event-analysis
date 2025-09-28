 #!/usr/bin/env python3
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
backend_port = os.getenv("BACKEND_PORT", 5001)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(port=backend_port)