# End-to-End Testing and Running Guide — OrbitalWatch 🛰️

This guide provides step-by-step instructions for running, testing, and verifying the **OrbitalWatch** Space Situational Awareness (SSA) dashboard end-to-end.

---

## 📖 Table of Contents

1. [Overview & Architecture Summary](#1-overview--architecture-summary)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Environment Setup & Configuration](#3-environment-setup--configuration)
4. [Running the Application End-to-End](#4-running-the-application-end-to-end)
    - [Step 1: Database Migrations](#step-1-database-migrations)
    - [Step 2: Satellite Data Ingestion & Seeding](#step-2-satellite-data-ingestion--seeding)
    - [Step 3: Launching the Backend ASGI Server](#step-3-launching-the-backend-asgi-server)
    - [Step 4: Launching the Frontend Web Client](#step-4-launching-the-frontend-web-client)
5. **End-to-End Testing Suite**
    - [Backend PyTest Suite](#backend-pytest-suite)
    - [Backend Integration & Verification Script](#backend-integration--verification-script)
    - [Frontend Vitest Unit & Component Suite](#frontend-vitest-unit--component-suite)
    - [Frontend Code Quality & Linting](#frontend-code-quality--linting)
6. [Troubleshooting & Common Operations](#6-troubleshooting--common-operations)

---

## 1. Overview & Architecture Summary

OrbitalWatch is composed of two primary tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                 React 19 + Vite 6 Dashboard                │
│  - Three.js 3D WebGL Globe       - Instant Search Bar        │
│  - Launch Clearance Simulator    - Real-Time Alerts Panel    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket (Socket.IO)
┌──────────────────────────────▼──────────────────────────────┐
│                  FastAPI + Socket.IO Server                 │
│  - SGP4 Orbital Propagator       - CelesTrak Ingestion      │
│  - Conjunction Risk Scanner     - SQLite / PostgreSQL DB   │
└─────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> When running locally, the frontend Vite dev server runs at `http://localhost:5173` and proxies API (`/api`, `/ping`) and WebSocket (`/socket.io`) connections to the backend server at `http://localhost:8000`.

---

## 2. Prerequisites & System Requirements

### Hardware Requirements
- **CPU**: Dual-core processor (Quad-core recommended for background SGP4 propagation)
- **RAM**: Minimum 4 GB (8 GB+ recommended)
- **GPU**: WebGL 2.0 compatible hardware for smooth 3D globe rendering

### Software Dependencies
- **Python**: Version `3.10` or higher
- **Node.js**: Version `18.0.0` or higher (`v20+` recommended)
- **npm**: Version `9.0.0` or higher

---

## 3. Environment Setup & Configuration

### Backend Environment Configuration (`backend/.env`)

Copy the example configuration file in the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

| Key | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./orbitalwatch.db` | Async SQLAlchemy database URI |
| `REDIS_URL` | `redis://localhost:6379/0` | Optional Redis URL for Pub/Sub notifications |
| `CORS_ORIGINS` | `["http://localhost:5173","http://127.0.0.1:5173"]` | Allowed cross-origin frontend domains |
| `HOST` | `0.0.0.0` | Host IP address to bind server |
| `PORT` | `8000` | Port for REST API and Socket.IO server |

---

## 4. Running the Application End-to-End

### Step 1: Database Migrations

Navigate to the `backend/` directory and execute Alembic schema migrations:

```bash
cd backend
python -m alembic upgrade head
```

> [!TIP]
> This creates or updates the SQLite/PostgreSQL schema with `satellites` and `conjunctions` tables automatically.

---

### Step 2: Satellite Data Ingestion & Seeding

Populate the local database with real Celestrak TLE records and synthetic orbital categories:

```bash
python seed.py
python seed_debris.py
```

- `seed.py`: Fetches active satellites, space stations, visual objects, GEO satellites, and space debris from CelesTrak GP API.
- `seed_debris.py`: Ensures at least 25 satellites per category (`payload`, `debris`, `rocket body`, `unknown`) are populated for balanced tracking.

---

### Step 3: Launching the Backend ASGI Server

Start the FastAPI and Socket.IO ASGI server:

```bash
python app.py
```

Output confirming successful startup:
```text
Running database migrations for local development...
INFO:     Started server process [8000]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

- **Interactive Swagger Docs**: [`http://localhost:8000/docs`](http://localhost:8000/docs)
- **Health Check Endpoint**: [`http://localhost:8000/health`](http://localhost:8000/health)

---

### Step 4: Launching the Frontend Web Client

Open a second terminal window and start the Vite frontend development server:

```bash
cd frontend
npm install
npm run dev
```

Output confirming frontend startup:
```text
  VITE v6.4.3  ready in 400 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open your browser and navigate to **`http://localhost:5173`**.

---

## 5. End-to-End Testing Suite

### Backend PyTest Suite

Run backend unit and integration tests covering API endpoints, SGP4 propagation, TLE checksums, and conjunction risk formulas:

```bash
cd backend
pytest -v
```

#### Covered Test Modules:
- `tests/test_api.py`: Tests `/`, `/ping`, `/health`, `/api/stats`, and `/api/refresh`.
- `tests/test_propagation.py`: Tests SGP4 satellite position calculation, altitude bands, and velocity vectors.
- `tests/test_conjunctions.py`: Tests risk threshold formulas and Foster $P_c$ collision probability math.
- `tests/test_search_and_ingest.py`: Tests TLE checksum modulo 10, object classification rules, and fallback catalog generation.

---

### Backend Integration & Verification Script

Run the automated live verification script while the backend server is running on port 8000:

```bash
cd backend
python verify_backend.py
```

Expected output:
```text
PASS health
PASS satellites
PASS iss
PASS propagate iss
PASS conjunctions
PASS socketio satellite_positions
```

---

### Frontend Vitest Unit & Component Suite

Execute the frontend unit test suite covering components, state context, search bar, and info cards:

```bash
cd frontend
npm test -- --run
```

#### Covered Test Files:
- `src/App.test.jsx`: Tests root app rendering and service mocking.
- `src/components/Dashboard/SearchBar.test.jsx`: Tests instant local search, debounced API calls, keyboard navigation, and result selection.
- `src/components/Dashboard/SatelliteInfo.test.jsx`: Tests unselected state, skeleton loading, and metric formatting.
- `src/context/AppContext.test.jsx`: Tests provider initialization, active view navigation, and selection state.

---

### Frontend Code Quality & Linting

Verify ESLint compliance across all frontend files:

```bash
cd frontend
npm run lint
```

---

## 6. Troubleshooting & Common Operations

### Port Conflicts
- If port `8000` is already in use, set a custom port before launching:
  ```bash
  PORT=8080 python app.py
  ```
- If port `5173` is in use, Vite will automatically select `5174` or prompt to switch.

### Resetting the Database
To wipe and re-seed the local SQLite database from scratch:

```bash
cd backend
rm orbitalwatch.db
python -m alembic upgrade head
python seed.py
```

### Running Frontend in Offline / Standalone Mode
If the backend server is offline or waking up, the frontend automatically uses built-in fallback satellite data (`ISS`, `Hubble`, `Tiangong`, `Starlink`, `NOAA`, `Cosmos`, `Iridium`, `Falcon 9`, `CZ-2D`) so search and visualizers continue working cleanly without breaking.
