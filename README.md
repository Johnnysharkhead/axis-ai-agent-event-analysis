# Axis Project

This repository contains a full-stack application with a **React frontend** and a **Flask backend**, both running inside Docker.

---

## 🚀 How to run the project

Once you have git, docker and docker-compose installed. Follow these steps

### 1. Clone the repo
````
git clone <repo-url>
cd company3
````

### 2. Copy environment variables
````
cp .env.example .env
````

### 3. Update .evn
Then go to the file `.env` that you just created from teh file .env.example and replace the outcommented variables with the real secret keys (more detailed instruction are found in the file `.env.example`).


### 3. Start everything
Everything before this is only first time setup. But now we start to enviorment with this command every time:
````
docker compose up --build
````

* Frontend will be available at: http://localhost:3000 (or the port you have specified for frontend in the file `.env`)
* Backend (Flask) will be available at: http://localhost:5001 (or the backend port you have specified in `.env`)

#### Stop everything with:
````
docker-compose down -v
````

## 📂 Repo structure
````
company3/
├─ backend/                # Python backend (Flask API, video ingest, auth)
│    ├─ main.py              # Entry point for the Flask application
│    ├─ requirements.txt     # Python dependencies for backend
│    ├─ Dockerfile           # Dockerfile for backend container
│    ├─ instance/            # Local runtime files
│    │  └─ database.db       # Local SQLite database (ignored in git, development only)
│    └─ tests/               # Unit and integration tests for backend
│
├─ frontend/               # React frontend
│    ├─ public/              # Static files (index.html, favicon, images etc)
│    │  └─ index.html        # Root HTML file, React is mounted here
│    ├─ src/                 # Frontend source code
│    │  ├─ App.jsx           # Root React component
│    │  ├─ index.jsx         # Entry point mounting React into DOM
│    │  ├─ routes.jsx        # Application routes (defines navigation between pages)
│    │  └─ components/       # Reusable React components (buttons, cards, modals, etc.)
│    │  └─ layouts/          # Shared layout wrappers (e.g. sidebar, header, footer)
│    │  └─ pages/            # Page-level components (views mapped to routes)
│    │  └─ styles/           # Global and component-specific stylesheets
│    │  └─ utils/            # Utility/helper functions (formatting, API calls, constants)
│    ├─ package.json         # Node dependencies and scripts
│    ├─ package-lock.json    # Lockfile ensuring exact dependency versions
│    └─ Dockerfile           # Dockerfile for frontend container
│
├─ config/                 # System and application configuration files
│
├─ test/                   # System integration tests
│
├─ docs/                   # Project documentation
│    ├─ git-guidelines.md    # Git workflow and commit/branching rules
│    └─ docker.md            # Docker usage and setup instructions
│
├─ .env                    # Local environment variables (not in Git)
├─ .env.example            # Template for environment variables (shared)
├─ docker-compose.yml      # Compose setup to run backend & frontend containers
├─ .gitignore              # Files that are not added to Git
├─ .gitlab-ci.yml          # GitLab CI/CD pipelines
└─ README.md               # Project documentation and instructions
````

## ⚡ Best prectices 
* Do not commit node_modules/ or venv/
* Always commit package-lock.json (frontend) and requirements.txt (backend)
* Use Docker for all development — no need to install Node, Python or anything else globally on your computer