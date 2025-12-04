# Axis Intelligent Security Surveillance System

Intelligent Security Surveillance Platform featuring an autonomous AI Agent pipeline that analyzes camera detection events and generates actionable security reports. 

Key AI Features:
• 🤖 AI Security Agent - Autonomous LLM-powered analyst using Phi4-Mini
• 📊 Smart Summarization - Generates structured Event/Location/Suggestion reports
• 💬 Natural Language Output - Human-readable security insights from raw sensor data
• ⚡ Intelligent Caching - Daily summary persistence to avoid redundant LLM calls
• 🔗 Multi-Camera Fusion - TrackFusion algorithm correlates detections across cameras

Tech Stack: Flask | React | Ollama | PostgreSQL | MQTT | Docker

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Backend](https://img.shields.io/badge/Backend-Flask-green)
![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB)
![AI](https://img.shields.io/badge/AI-Ollama%20Phi4--Mini-orange)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Axis Network Cameras                         │
│                    (Q1656 with built-in analytics)                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
    ┌──────────────────┐              ┌──────────────────┐
    │   RTSP Stream    │              │   MQTT Metadata  │
    │  (Live Video)    │              │   (Detections)   │
    └────────┬─────────┘              └────────┬─────────┘
             │                                  │
             ▼                                  ▼
    ┌──────────────────┐              ┌──────────────────┐
    │   Flask Backend  │◄────────────►│  Mosquitto MQTT  │
    │   (REST API)     │              │    (Broker)      │
    └────────┬─────────┘              └──────────────────┘
             │
    ┌────────┴─────────────────────────┐
    │                                  │
    ▼                                  ▼
┌──────────────┐              ┌──────────────────┐
│  PostgreSQL  │              │   Ollama LLM     │
│  (Neon DB)   │              │  (Phi4-Mini)     │
└──────────────┘              └──────────────────┘
             │
             ▼
    ┌──────────────────┐
    │  React Frontend  │
    │   (Dashboard)    │
    └──────────────────┘
```

## ✨ Key Features

### 🎥 Real-Time Video Surveillance
- **Multi-camera RTSP streaming** with adaptive quality control
- **Live video feed** with low-latency playback
- **Recording management** with playback and download capabilities
- **Snapshot capture** for event documentation

### 🤖 AI-Powered Security Agent
- **Autonomous AI Agent** powered by local Phi4-Mini LLM
- **Automated event analysis** generating structured security reports
- **Smart caching** - Daily summaries stored to avoid redundant LLM calls
- **Configurable parameters** (temperature, top_k, num_predict) via environment variables

### 📡 Multi-Camera Track Fusion
- **TrackFusion Algorithm** - Correlates detections across multiple cameras
- **Spatial matching** - Links observations within 0.5m proximity
- **Global track management** - Maintains unified identity across camera views
- **Automatic track cleanup** - Removes stale tracks after timeout

### 🚨 Intrusion Detection
- **Zone-based monitoring** with customizable boundaries
- **Real-time alerts** when intrusions are detected
- **Event history** with detailed logs and metadata
- **GPS coordinate tracking** for precise location data

### 🗺️ 2D Floor Plan Visualization
- **Interactive floor plan** with camera overlay
- **Real-time position tracking** of detected persons
- **Zone configuration** with drag-and-drop editing
- **Heatmap visualization** for traffic analysis

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Windows) or Docker + Docker Compose (Linux)
- [Git](https://git-scm.com/downloads)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd axis-security-system
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   
   # Ports
   FRONTEND_PORT=3000
   BACKEND_PORT=5001
   
   # Camera credentials
   camera_login=admin
   camera_password=yourpassword
   
   # AI Settings (optional)
   OLLAMA_MODEL_NAME=phi4-mini
   OLLAMA_TEMPERATURE=0.1
   ```

3. **Start the services**
   
   **Without AI Agent:**
   ```bash
   docker compose up --build
   ```
   
   **With AI Agent (requires ~8GB RAM):**
   ```bash
   docker compose --profile ai up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001
   - AI Service: http://localhost:11434

### Stopping the Services
```bash
# Without AI
docker compose down -v

# With AI
docker compose --profile ai down -v
```

---

## 📁 Project Structure

```
axis-security-system/
├── ai_service/                 # Ollama LLM container
│   └── Dockerfile
├── backend/                    # Flask REST API
│   ├── main.py                 # Application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── routes/                 # API endpoints
│   │   ├── ai_routes.py        # AI analysis endpoints
│   │   ├── authentication.py   # User auth
│   │   ├── camera_config_routes.py
│   │   ├── event_routes.py
│   │   ├── recording_routes.py
│   │   └── zone_routes.py
│   ├── application/            # Business logic
│   │   ├── ai_analysis.py      # AI Agent pipeline
│   │   └── hls_handler.py      # HLS streaming
│   ├── domain/                 # Data models
│   │   └── models/
│   │       ├── camera.py
│   │       ├── fusion_data.py
│   │       ├── daily_summary.py
│   │       ├── user.py
│   │       └── zone.py
│   ├── infrastructure/         # External integrations
│   │   ├── mqtt_client.py      # MQTT message handler
│   │   ├── track_fusion.py     # Multi-camera fusion algorithm
│   │   ├── fusion_persistence.py
│   │   ├── livestream.py       # RTSP video capture
│   │   ├── intrusion_detection.py
│   │   └── video_saver.py
│   └── tests/                  # Unit tests
├── frontend/                   # React application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js    # Main dashboard with AI summary
│   │   │   ├── LiveCameraPage.js
│   │   │   ├── Floormap2D.js
│   │   │   ├── ZoneConfiguration.js
│   │   │   ├── EventHistoryPage.js
│   │   │   └── RecordingLibrary.js
│   │   ├── components/
│   │   │   ├── CameraPlayer.js
│   │   │   ├── HeatmapOverlay.js
│   │   │   └── RoomConfiguration.js
│   │   └── utils/
│   │       └── api.js          # API client
│   └── public/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/logout` | User logout |

### AI Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/latest-analysis` | Get AI security summary (cached daily) |
| GET | `/api/ai/history` | Get last 10 AI summaries |

### Cameras
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cameras` | List all cameras |
| GET | `/api/cameras/<id>/stream` | Get RTSP stream |
| POST | `/api/cameras/<id>/snapshot` | Capture snapshot |

### Zones
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zones` | List all zones |
| POST | `/api/zones` | Create zone |
| PUT | `/api/zones/<id>` | Update zone |
| DELETE | `/api/zones/<id>` | Delete zone |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List intrusion events |
| GET | `/api/events/<id>` | Get event details |

---

## 🧠 AI Agent Configuration

The AI Agent uses Ollama with Phi4-Mini model for generating security summaries.

### Environment Variables
```env
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL_NAME=phi4-mini
OLLAMA_TEMPERATURE=0.1      # Lower = more deterministic
OLLAMA_TOP_K=3              # Consider top 3 tokens
OLLAMA_NUM_PREDICT=256      # Max tokens to generate
```

### AI Output Format
The agent generates structured reports with three sections:
```
Event: [What happened with timestamp and camera details]
Location: [GPS coordinates of the detection]
Suggestion: [Actionable recommendation for security team]
```

### Caching Behavior
- Daily summaries are cached in the database
- Subsequent requests on the same day return cached results
- No redundant LLM calls when refreshing the dashboard

---

## 🔧 Development

### Running Tests
```bash
# Backend tests
docker compose exec backend pytest

# Frontend tests
docker compose exec frontend npm test
```

### Database Migrations
```bash
docker compose exec backend flask db upgrade
```

### Adding New Dependencies
```bash
# Backend (Python)
echo "package-name" >> backend/requirements.txt
docker compose build backend

# Frontend (Node.js)
docker compose exec frontend npm install package-name
```

---

## 📊 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, JavaScript, CSS |
| Backend | Flask, Python, SQLAlchemy |
| Database | PostgreSQL (Neon) |
| Message Broker | Mosquitto (MQTT) |
| AI/ML | Ollama, Phi4-Mini LLM |
| Video | OpenCV, RTSP, HLS |
| Containerization | Docker, Docker Compose |

---

## ⚡ Best Practices

- Do **NOT** commit `node_modules/`, `venv/`, `.env`, or `backend/instance/`
- Always commit `package-lock.json` (frontend) and `requirements.txt` (backend)
- Use Docker for all development — no need to install Node, Python, or other dependencies globally

---

## 📄 License

This project was developed as part of a university course collaboration with Axis Communications.

---

**Note**: This system is designed to work with Axis network cameras. Ensure you have proper camera credentials and network access configured.