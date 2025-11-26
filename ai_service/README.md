# Local AI Agent

This service powers the intelligence layer of the Security System. Built on **Ollama**, it hosts a lightweight **Llama 3.2 (1B)** model designed to process raw camera metadata, events and generate human-readable security summaries for the operator asynchronously.

**Key Features:**
* **Offline-First:** The LLM is "baked" directly into the Docker image, requiring no internet connection to run.
* **Universal Compatibility:** Optimized for standard CPU inference, ensuring stability across Windows, Mac (M-Series), and Linux. Also supports GPU if enabled from docker compose file.
* **Privacy-Centric:** All data processing happens locally within the container network, no video data or metadata is ever sent to external cloud APIs.
* **Optional Execution:** Integrated via Docker Compose profiles (`--profile ai`) to conserve resources when not in use.



## 🏗 Architecture

The system runs on **Docker** and consists of 4 main containers:

1.  **Frontend (React):** Dashboard for monitoring cameras and alerts.
2.  **Backend (Flask):** Handles business logic, database connections, and MQTT subscriptions.
3.  **MQTT Broker (Mosquitto):** Receives raw metadata from security cameras.
4.  **AI Service (Ollama):** A local AI agent (Llama 3.2 1B) that summarizes JSON event data into natural language.

## 🚀 Prerequisites

  * **Docker Desktop** (running)
  * **Git**

## 📂 Project Structure

```text
company3/
├── ai_service/       # Dockerfile for the AI Agent (Preloaded Model)
├── backend/          # Flask API & MQTT Logic
├── frontend/         # React Dashboard
├── mosquitto-data/   # Persistence for MQTT
├── docker-compose.yml
└── .env              # Environment variables
```


## 🛠 How to Run

This project uses **Docker Compose Profiles** to make the heavy AI service optional. You can choose which mode to run based on your hardware capabilities.

### Option 1: Full Mode (AI Enabled) 🧠

*Recommended for development with AI features.*
Runs all 4 containers. The first run will take time to build the image (baking in the 1.3GB model).

```powershell
docker compose --profile ai up --build
```

### Option 2: Lite Mode (No AI) ⚡

*Recommended for Frontend/Backend specific tasks.*
Runs only Frontend, Backend, and MQTT. Saves CPU/RAM.

```powershell
docker compose up --build
```

### Option 3: GPU Acceleration (NVIDIA Only) 🚀

If you have an NVIDIA GPU, you can enable hardware acceleration for faster AI responses:

1.  Open `docker-compose.yml`.
2.  Uncomment the `deploy: resources: ...` section under the `ollama` service.
3.  Run: `docker compose --profile ai up`


## ✅ Verification

### Check if AI is running

Once the containers are up (in Full Mode), you can test the AI manually via terminal:

```powershell
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:1b",
  "stream": false,
  "prompt": "Summarize this event: { \"object\": \"person\", \"time\": \"10:00 AM\", \"zone\": \"Entrance\" }"
}'
```

If you receive a JSON response, the integration is successful.



### AI Model Details

  * **Model:** Llama 3.2 (1B Parameters)
  * **Size:** \~1.3 GB
  * **Storage:** The model is "baked" into the Docker image during the build process, allowing it to work completely **offline**.
  * **Persistence:** A Docker volume `ollama_storage` is used to save any additional data.


## 🔧 Troubleshooting

**1. "connection refused" on port 11434**

  * Make sure you used the `--profile ai` flag. If you just ran `docker compose up`, the AI container stays turned off.

**2. Build fails during `ollama pull`**

  * Ensure you have a stable internet connection for the initial build (to download the model). Once built, internet is not required.

**3. "Context Deadline Exceeded" in Backend**

  * The AI might be running slowly on CPU. Increase the timeout in your Python `requests.post` call.