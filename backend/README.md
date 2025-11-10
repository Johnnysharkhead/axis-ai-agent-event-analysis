# Backend

This is the Flask backend for the project.  
It exposes REST API endpoints that the React frontend can consume.

---

## 🚀 How to run

Follow instructions under `docs/docker.md`. 

Then the backend will be available at: http://localhost:5001  
Example endpoint:
````
GET /hello
````

returns:
````
{ "message": "Hello from Flask 🚀" }
````

## 📂 Structure of backend folder 

### Backend Architecture

The backend follows a **layered architecture** pattern for better organization and maintainability:

```
backend/
├── routes/              # API endpoints (HTTP layer)
│   ├── authentication.py
│   ├── video_routes.py
│   ├── recording_routes.py
│   └── snapshot_routes.py
├── application/         # Business logic & use cases
│   └── hls_handler.py
├── domain/              # Core business models
│   └── models/
│       ├── user.py
│       ├── camera.py
│       ├── recording.py
│       └── room.py
├── infrastructure/      # External integrations & technical concerns
│   ├── livestream.py        # Camera RTSP adapter
│   ├── video_saver.py       # Recording manager
│   ├── mqtt_client.py       # MQTT broker integration
│   └── migrations/          # Database migrations
└── main.py              # Application entry point
```

**Layer Responsibilities:**
- **routes/** - Handle HTTP requests, return responses
- **application/** - Coordinate workflows, orchestrate operations  
- **domain/** - Define business entities and rules
- **infrastructure/** - Connect to external systems (cameras, MQTT, database)

## � Updating Your Branch After Restructure

If you have an active feature branch, you'll need to update it to match the new structure:

**1. Update your branch:**
```bash
git checkout your-branch
git fetch origin
git rebase origin/develop
```

**2. Fix import paths (find & replace):**
- `from livestream` → `from infrastructure.livestream`
- `from video_saver` → `from infrastructure.video_saver`
- `from mqtt_client` → `from infrastructure.mqtt_client`
- `from models` → `from domain.models`
- `from hls_handler` → `from application.hls_handler`
- `import authentication` → `import routes.authentication`

**3. If you see file location conflicts:**
Git might say a file was deleted but you modified it. This means it was moved:
- Find your changes in the old location
- Apply them to the new location (check structure above)
- Delete the old file: `git rm old/path/file.py`

**4. Test it works:**
```bash
docker-compose build backend
docker-compose up
```

**Need help?** Ping the team in Slack!

## �📦 Database
* By default, Flask uses SQLite with a `database.db` file inside instance/
* The file is ignored in Git (so each developer has their own local DB)
* The app auto-create the database on startup (done in `backend/main.py`)  

## ⚡ Best practices
* Keep API routes clear and consistent
* Do NOT commit `instance/database.db`
* Add all dependencies to `requirements.txt`
* Use Docker for running Flask -> no global Python install etc needed
