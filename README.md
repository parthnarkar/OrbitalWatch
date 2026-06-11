# OrbitalWatch 🛰️

OrbitalWatch is a modern, high-performance, real-time **Space Situational Awareness (SSA)** dashboard that tracks orbiting objects, calculates collision risks (conjunctions), and visualizes satellites on an interactive 3D Earth.

Built during a hackathon sprint, the project democratizes satellite tracking and collision analysis for small operators, university space labs, and debris researchers.

---

## 🚀 Key Features

*   **Interactive 3D Globe**: Renders 3D Earth with real-time satellite positions using WebGL (Three.js and React Three Fiber).
*   **SGP4 Orbital Propagation**: Backend propagates Two-Line Element (TLE) datasets in real-time to compute latitude, longitude, altitude, velocity, and orbital paths.
*   **Conjunction Alert System**: Scans and evaluates potential close approaches within a 5 km threshold over the next 72 hours, color-coding risk severity.
*   **Real-Time Telemetry Streaming**: Uses Socket.IO WebSockets to stream live position updates directly to connected frontend clients.
*   **Search & Analytics Panel**: Search satellites by name or NORAD ID, lock the camera to track specific objects, and view orbital trails.

---

## 🛠️ Technology Stack

| Layer | Technologies | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 6, Tailwind CSS, Recharts | Interactive UI, charts, and responsive dashboards. |
| **3D Rendering** | Three.js, React Three Fiber (R3F), Drei | Interactive 3D Earth, orbit trails, and satellite dots. |
| **Backend** | FastAPI, Gunicorn, Uvicorn, Python 3.10/3.11 | High-performance async API and WebSocket endpoints. |
| **Physics Engine**| Skyfield, SGP4 | Precise orbital mechanics and coordinate propagation. |
| **Database** | PostgreSQL, asyncpg, SQLAlchemy | Relational storage for satellite metadata and TLE files. |
| **Cache/PubSub** | Redis (or Valkey on Render) | Position caching and WebSocket alert pub/sub. |

---

## 📂 Project Structure

```
OrbitalWatch/
├── backend/            # FastAPI Backend
│   ├── app/            # Source code (API routers, models, schemas, core logic)
│   ├── alembic/        # Database migration files
│   ├── Dockerfile      # Production container configuration
│   ├── requirements.txt# Python package dependencies
│   └── start.sh        # Startup script executing migrations and starting Gunicorn
├── frontend/           # React + Vite Frontend
│   ├── src/            # Components, Hooks, API, and WebSocket services
│   ├── public/         # Static assets
│   ├── vercel.json     # Vercel deployment configuration (routes, security headers)
│   └── package.json    # Frontend dependencies and scripts
└── README.md           # Main repository documentation
```

---

## 💻 Local Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18.0.0+)
*   [Python](https://www.python.org/) (3.10 or 3.11)
*   *Optional:* Docker and Docker Compose

### 1. Backend Setup
1. Navigate into the backend directory and create a virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up your local environment file:
   ```bash
   cp .env.example .env
   ```
   *By default, the backend runs seamlessly on a local SQLite database (`orbitalwatch.db`) and falls back gracefully if Redis is not running.*
4. Run database migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the local server:
   ```bash
   python app.py
   ```
   *The API will be available at `http://localhost:8000`. You can visit `http://localhost:8000/docs` for interactive Swagger documentation.*

---

### 2. Frontend Setup
1. Navigate into the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🌐 Production Deployment

### 1. Backend Deployment (Render)
The backend is optimized to run as a **Web Service** on Render using the native Docker environment or Python 3.10.

#### Render Configurations:
*   **Root Directory**: `backend`
*   **Language**: `Docker` *(Recommended: Render builds automatically from the Dockerfile)* or `Python 3`
    *   *If Python 3:* set build command to `pip install -r requirements.txt` and start command to `gunicorn app.main:socket_app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
*   **Environment Variables**:
    *   `PYTHON_VERSION`: `3.10` or `3.11`
    *   `DATABASE_URL`: Add your PostgreSQL internal/external URI string (automatically converted to `postgresql+asyncpg://` internally).
    *   `REDIS_URL`: Add your Render Key-Value (Valkey) or Upstash Redis URL to support WebSocket streaming.
    *   `CORS_ORIGINS`: `["https://your-app.vercel.app"]` *(Replace with your Vercel URL)*.
    *   `RELOAD`: `false`

---

### 2. Frontend Deployment (Vercel)
Vercel hosts the React client and uses a rewrite configuration to direct routing to `index.html` for single-page routing (SPA).

#### Vercel Configurations:
*   **Framework Preset**: `Vite`
*   **Root Directory**: `frontend`
*   **Environment Variables**:
    *   `VITE_API_URL`: `https://orbitalwatch-backend.onrender.com/api` *(Your Render Web Service URL + /api)*
    *   `VITE_WS_URL`: `https://orbitalwatch-backend.onrender.com` *(Your Render Web Service URL)*

---

## 🎹 Keyboard Shortcuts

Quickly control the frontend dashboard with these hotkeys:
*   `/` — Focus Search Bar
*   `a` — Switch to Conjunction Alerts View
*   `g` — Switch to Globe View
*   `f` — Toggle following/locking camera to the selected satellite
*   `d` — Toggle Demo Mode
*   `Escape` — Close any open overlays or panels
*   `?` — Open Keyboard Shortcuts Help Modal
