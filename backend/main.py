 #!/usr/bin/env python3
from flask import Flask
from flask_sqlalchemy import SQLAlchemy


app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(port=5000) # På MacOS, byt till 5001 eller dylikt