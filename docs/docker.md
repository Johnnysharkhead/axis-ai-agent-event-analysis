# 🐳 Docker in this project

This project is fully containerized with **Docker**.  
That means you do **not** need to install Python, Flask, Node, or React locally — everything runs inside containers.

---

## 🔧 How it works

We use **docker-compose** to run both services:

- **backend/** → Flask (Python) API, runs on port `5000`  
- **frontend/** → React (Node.js) web app, runs on port `3000`

Both services run inside the same Docker network, so the frontend can talk to the backend with requests like:

```
fetch("http://localhost:5000/hello")
```

## 📂 Files

backend/Dockerfile
* Starts from python:3.11-slim
* Installs packages from requirements.txt
* Runs Flask on port 5000

frontend/Dockerfile
* Starts from node:18
* Installs dependencies from package.json
* Runs React dev server on port 3000

docker-compose.yml
* Defines both services
* Exposes frontend (3000) and backend (5000) to localhost
* Mounts source code so changes are reflected immediately

## 🚀 Commands
Build containers (first time or after Dockerfile changes): 
````
docker-compose build
````
Start everything:
````
docker-compose up
````
Frontend → http://localhost:3000  
Backend → http://localhost:5000

Stop everything: 
````
docker-compose down
````
Stop docker (and also remove volumes --> clean slate):
````
docker-compose down -v
````