# Axis Project

This repository contains a full-stack application with a **React frontend** and a **Flask backend**, both running inside Docker.

---

## 🚀 How to run the project

1. Clone the repo from GitLab (only first time setup)

2. Make sure you have **Docker** and **docker-compose** installed (only first time setup)

3. Update the secrets keys in your `.env` file (more detailed instruction are found in the file `.env.example`)

3. I your terminal, navigate to the **project root** (company3) and run:
````
docker-compose build
docker-compose up
````

* Frontend will be available at: http://localhost:3000
* Backend (Flask) will be available at: http://localhost:5000

#### Stop everything with:
````
docker-compose-down
````

## 📂 Repo structure
````
company3/  
├── backend/            # Flask backend (API)  
├── frontend/           # React frontend (UI)  
└── docker-compose.yml  # Runs both frontend and backend  
````

## ⚡ Best prectices 
* Do not commit node_modules/ or venv/
* Always commit package-lock.json (frontend) and requirements.txt (backend)
* Use Docker for all development — no need to install Node, Python or anything else globally on your computer