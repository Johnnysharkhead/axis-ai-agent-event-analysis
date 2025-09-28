# 🐳 Docker in this project

This project is fully containerized with **Docker**.  
That means you do **not** need to install Python, Flask, Node, or React locally — everything runs inside containers.

---
## 🔧 First time setup
#### 1. Install Git  
Make sure you have Git, otherwise [download git](https://git-scm.com/downloads)

#### 2. Install Docker  
Make sure you have Docker installed, otherwise: 
* On Mac/Windows → install [Docker Desktop](https://www.docker.com/products/docker-desktop/)  
* On Linux → install `docker` and `docker-compose` via package manager

#### 3. Clone the repository
````
git clone <repo-url-from-GitLab>
cd company3
````

#### 4. Create an enviorment file (`.env`)
````
cp .env.example .env
````

#### 5. Update .env
Adjust values inside `.env` if needed (e.g., backend or frontend ports).Take away the outcommented values and replace with the real secret values.  
More detailed instruction are found in the file `.env.example`. 

#### 6. Build and start containers 
````
docker-compose up --build
````

#### 7. Access the services 
* Frontend → [http://localhost:3000](http://localhost:3000) (or the port you have specified in the `.env` file)
* Backend → [http://localhost:5001](http://localhost:5001) (or the port you have specified in the `.env` file)


## 🔧 How it works

We use **docker-compose** to run both services:

- **backend/** → Flask (Python) API, runs on port `5001` (or the one you have speciefied in `.env`)  
- **frontend/** → React (Node.js) web app, runs on port `3000` (or the one you have speciefied in `.env`)  

Both services run inside the same Docker network, so the frontend can talk to the backend with requests like:

```
fetch("http://localhost:5001/hello")
```

## 📂 Files

backend/Dockerfile
* Starts from python:3.11-slim
* Installs packages from requirements.txt
* Runs Flask on port 5001

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
Backend → http://localhost:5001

Stop everything: 
````
docker-compose down
````
Stop docker (and also remove volumes --> clean slate):
````
docker-compose down -v
````