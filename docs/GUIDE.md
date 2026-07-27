# End-to-End Testing and Running Guide — OrbitalWatch 🛰️

This guide provides step-by-step instructions for running, testing, and verifying the **OrbitalWatch** Space Situational Awareness (SSA) dashboard end-to-end.

---

## 📖 Table of Contents

1. [Overview & Architecture Summary](#1-overview--architecture-summary)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Environment Setup & Configuration](#3-environment-setup--configuration)
4. [Running the Application End-to-End](#4-running-the-application-end-to-end)
    - [Step 1: Database Migrations](#step-1-database-migrations)
    - [Step 2: Satellite Data Ingestion](#step-2-satellite-data-ingestion)
    - [Step 3: Launching the Backend ASGI Server](#step-3-launching-the-backend-asgi-server)
    - [Step 4: Launching the Frontend Web Client](#step-4-launching-the-frontend-web-client)
5. **End-to-End Testing Suite**
    - [Backend PyTest Suite](#backend-pytest-suite)
    - [Backend Integration & Verification Script](#backend-integration--verification-script)
    - [Frontend Vitest Unit & Component Suite](#frontend-vitest-unit--component-suite)
    - [Frontend Code Quality & Linting](#frontend-code-quality--linting)
6. [Production Deployment & Running Guide](#6-production-deployment--running-guide)
7. [Production End-to-End Verification](#7-production-end-to-end-verification)
8. [Troubleshooting & Common Operations](#8-troubleshooting--common-operations)

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

### Step 2: Satellite Data Ingestion

No manual database seeding is required. When you start the ASGI server (Step 3), a background task automatically connects to CelesTrak and fetches TLE orbital data across the configured categories:
* **Active Payloads**: `weather`, `gps-ops`, `amateur`, `visual`, `stations`, `geo`
* **Debris Categories**: `iridium-33-debris`, `cosmos-2251-debris`, `fengyun-1c-debris`, `cosmos-1408-debris`

If the database is empty, the first conjunction scan will execute immediately after this initial ingestion completes.

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

## 6. Production Deployment & Running Guide

### Backend Production Deployment (e.g., Render, Railway, or VPS)
To deploy the backend to a production environment:
1. **Database Service**: Spin up a managed PostgreSQL database.
2. **Redis Service**: Set up a managed Redis/Valkey instance (highly recommended for production concurrency to support distributed alert pub/sub).
3. **ASGI Server Command**: Run the production ASGI server with `gunicorn` (for multi-worker clustering and scaling) using the Uvicorn worker class:
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 app.main:socket_app
   ```
4. **Environment Variables**: Define the following variables in your hosting environment:
   - `DATABASE_URL`: Connection URI for your PostgreSQL database (must use the `postgresql+asyncpg` driver, e.g., `postgresql+asyncpg://user:pass@host:port/dbname`).
   - `REDIS_URL`: Redis instance connection URI (e.g., `redis://user:pass@host:6379/0`).
   - `CORS_ORIGINS`: JSON list of allowed production frontend domains (e.g., `["https://orbitalwatch.vercel.app"]`).
   - `TLE_UPDATE_INTERVAL_HOURS`: Set to `24` (or any custom update window).
   - `HOST`: `0.0.0.0`
   - `PORT`: `8000`

### Frontend Production Deployment (e.g., Vercel, Netlify, or AWS S3)
To compile and deploy the static React application:
1. **Environment Variables**: Define the following build-time environment variables:
   - `VITE_API_URL`: The production backend API endpoint URL (e.g., `https://api.orbitalwatch.com/api`).
   - `VITE_WS_URL`: The production Socket.IO WebSocket base URL (e.g., `https://api.orbitalwatch.com`).
2. **Build the Bundle**:
   ```bash
   cd frontend
   npm run build
   ```
   This compiles and optimizes your React assets into the `dist/` directory.
3. **Static File Hosting**: Upload the contents of `dist/` to your static host.
   - For **Vercel** or **Netlify**, use the `vercel.json` rewrites configuration (already included in the frontend folder) to route all paths cleanly to `index.html` to allow client-side React routing to function.

---

## 7. Production End-to-End Verification

To verify that your production deployment is fully functional:

### 1. Automated API & WebSocket Verification
You can run the backend verification script against your live production server from any local machine by overriding the `BASE_URL` environment variable:
```bash
cd backend
BASE_URL=https://api.orbitalwatch.com python verify_backend.py
```
This script will test production HTTP endpoints (`/health`, `/api/satellites`, etc.) and establish a live WSS (Secure WebSocket) connection to verify Socket.IO functionality on the production domain.

### 2. Manual SSL and WebSocket Verification
Open your browser developer tools (F12) on the production site:
- **Network Tab (WS)**: Look for connection requests to `/socket.io/?EIO=4&transport=websocket`. Verify that the connection protocol is `wss://` (Secure WebSocket) and that it successfully upgrades (HTTP status code `101 Switching Protocols`).
- **CORS Violations**: Check the Console for any CORS warnings. If you see CORS errors, double-check that your production frontend URL is included in the backend's `CORS_ORIGINS` environment list.

---

## 8. Troubleshooting & Common Operations

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
python app.py
```
*Note: Starting `app.py` after a database wipe will automatically trigger a fresh CelesTrak elements load and conjunction scan.*

### Running Frontend in Offline / Standalone Mode
If the backend server is offline or waking up, the frontend automatically uses built-in fallback satellite data (`ISS`, `Hubble`, `Tiangong`, `Starlink`, `NOAA`, `Cosmos`, `Iridium`, `Falcon 9`, `CZ-2D`) so search and visualizers continue working cleanly without breaking.
