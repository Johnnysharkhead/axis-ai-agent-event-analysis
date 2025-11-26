# Axis Project

 This repository contains a microservices-based application running inside Docker, consisting of four key services:

 * **React (Frontend):** A real-time dashboard for monitoring security events.
 * **Flask (Backend):** The API layer that processes data and manages the database.
 * **Mosquitto (MQTT):** The message broker that ingests raw metadata from camera sensors.
 * **Ollama (AI):** A local Large Language Model (Llama 3.2) that generates human-readable event summaries.


## 🚀 First time setup

#### 1. Install Git  
Make sure you have Git, otherwise [download git](https://git-scm.com/downloads)

#### 2. Install Docker  
Make sure you have Docker installed, otherwise: 
* On Mac/Windows → install [Docker Desktop](https://www.docker.com/products/docker-desktop/)  
* On Linux → install `docker` and `docker-compose` via package manager

### 3. Clone the repo
````
git clone <repo-url-from-gitlab>
cd company3
````

### 4. Copy environment variables
Mac/Linux (bash):
````
cp .env.example .env
````
Windows (PowerShell):
````
copy .env.example .env
````


### 5. Update .evn
Open an editor, for example VS Code, and go to the file `.env`, that you just created from teh file .env.example. Replace the outcommented variables with the real secret keys (more detailed instruction are found in the file `.env.example`).

### 6. Start Project
Everything before this is only first time setup. But now we start to enviorment with this command every time a Dockerfile is updated:
```bash
# Builds Frontend, Backend and mqtt_broker
docker compose up --build
```

```bash
# Builds all container(Includes LLM)
docker compose --profile ai up --build
````

* Frontend will be available at: http://localhost:3000 (or the port you have specified for frontend in the file `.env`)
* Backend (Flask) will be available at: http://localhost:5001 (or the backend port you have specified in `.env`)
* AI Service (Ollama) will be available at: http://localhost:11434


#### Stop project:
```bash
# All except LLM
docker-compose down -v 
````
```bash
# All four containers
docker compose --profile ai down -v
````

## 📂 Repo structure
````
company3/
├─ ai_service/             # LLM (Ollama)
ai_service/ README.md
│        ├─ Dockerfile
├─ backend/                # Python backend (Flask) - more info in backend/README.md
│    ├─ main.py
│    ├─ requirements.txt
│    ├─ Dockerfile
│    └─ instance/
│       └─ database.db
│
├─ frontend/               # React frontend - more info in frontend/README.md
│    ├─ public/
│    ├─ src/
│    ├─ package.json
│    ├─ package-lock.json
│    └─ Dockerfile
│
├─ test/                   # System integration tests
│
├─ docs/                   # Documentation
│    ├─ git-guidelines.md
│    └─ docker.md
│
├─ .env                    # Local environment variables (not in Git)
├─ .env.example            # Template for environment variables (shared)
├─ docker-compose.yml      # Compose setup to run backend & frontend containers
├─ .gitignore              # Files that are not added to Git
├─ .gitlab-ci.yml          # GitLab CI/CD pipelines
└─ README.md               # Project documentation and instructions, this file :)
````

## ⚡ Best prectices 
* Do NOT commit `node_modules/` or `venv/` or `.env` or `backend/instance/`
* Always commit `package-lock.json` (frontend) and `requirements.txt` (backend)
* Use Docker for all development —> no need to install Node, Python or anything else globally on your computer