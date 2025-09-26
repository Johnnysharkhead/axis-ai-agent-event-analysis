# Backend

This is the Flask backend for the project.  
It exposes REST API endpoints that the React frontend can consume.

---

## 🚀 How to run

Follow instructions under `docs/docker.md`. 

Then the backend will be available at: http://localhost:5000  
Example endpoint:
````
GET /hello
````

returns:
````
{ "message": "Hello from Flask 🚀" }
````

## 📂 Structure of backend folder 
````
backend/
├── app.py              # Main Flask app
├── requirements.txt    # Python dependencies
├── Dockerfile          # Docker setup
└── instance/           # Database (ignored in Git)
    └── database.db     # Local SQLite database (not committed)
````

## 📦 Database
* By default, Flask uses SQLite with a `database.db` file inside instance/
* The file is ignored in Git (so each developer has their own local DB)
* The app can auto-create the database on startup

## ⚡ Best practices
* Keep API routes clear and consistent
* Do NOT commit `database.db`
* Add all dependencies to requirements.txt
* Use Docker for running Flask (no global Python install needed)
