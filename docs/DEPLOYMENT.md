# 🚀 OrbitalWatch Deployment & Environment Guide

This document provides a comprehensive guide on how OrbitalWatch manages configuration across **Local Development** and **Production** environments, step-by-step instructions for running locally, and deployment instructions for cloud platforms (**Render** and **Vercel**).

---

## 📐 Architecture Overview

```
LOCAL DEVELOPMENT                                PRODUCTION
┌───────────────────────────┐                    ┌───────────────────────────┐
│ Vite Dev Server           │                    │ Vercel (Frontend CDN)     │
│ http://localhost:5173     │                    │ https://<your-app>.vercel │
│                           │                    │                           │
│  Proxy Routing:           │                    │ Direct HTTP/WS Routing:   │
│  /api      ──► :8000      │                    │ VITE_API_URL ──► Render   │
│  /socket.io ──► :8000     │                    │ VITE_WS_URL  ──► Render   │
└─────────────┬─────────────┘                    └─────────────┬─────────────┘
              │                                                │
              ▼                                                ▼
┌───────────────────────────┐                    ┌───────────────────────────┐
│ FastAPI ASGI Backend      │                    │ Render Web Service        │
│ http://localhost:8000     │                    │ Python Runtime            │
│                           │                    │                           │
│ Storage:                  │                    │ Storage:                  │
│  • SQLite (orbitalwatch)  │                    │  • PostgreSQL (Managed)   │
│  • Redis (Optional)       │                    │  • Redis Pub/Sub (Managed)│
└───────────────────────────┘                    └───────────────────────────┘
```

---

## 🔑 Environment Variables Matrix

### 1. Backend (`backend/`)

In local development, settings are loaded from `backend/.env`.  
In production (Render), `.env` is **not deployed**; environment variables are supplied via the cloud provider's secret manager / dashboard.

| Variable | Local Dev (`.env`) | Production (Render Dashboard) | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./orbitalwatch.db` | `postgresql+asyncpg://<user>:<pass>@<host>/<db>` | Database connection string. |
| `REDIS_URL` | `redis://localhost:6379/0` | `redis://:<password>@<host>:<port>` | Pub/Sub for multi-worker WebSocket notifications. |
| `CORS_ORIGINS` | `["http://localhost:5173","http://127.0.0.1:5173"]` | `["https://orbital-watch-bay.vercel.app"]` | JSON array of allowed cross-origin domains. |
| `RELOAD` | `true` | `false` | Enables Uvicorn hot-reloading for code changes. |
| `WEB_CONCURRENCY` | `1` | `1` | Number of Uvicorn workers. (Keep at 1 for Render Free tier 512MB RAM). |
| `PYTHON_VERSION` | `3.10.0` | `3.11` | Python runtime version. |

> [!CAUTION]
> **No Inline Comments in `.env`**: `python-dotenv` parses everything after the `=` as part of the value.  
> **Incorrect**: `DATABASE_URL=sqlite+aiosqlite:///./orbitalwatch.db # local db`  
> **Correct**: Put comments on their own line preceding the key.

---

### 2. Frontend (`frontend/`)

Vite automatically switches environment files based on the build target:
- `npm run dev` loads `frontend/.env.development`
- `npm run build` loads `frontend/.env.production`

| Variable | `.env.development` | `.env.production` | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | `""` *(empty string)* | `https://orbitalwatch-backend.onrender.com` | Base REST API URL. Empty string uses Vite proxy locally. |
| `VITE_WS_URL` | `/` | `https://orbitalwatch-backend.onrender.com` | Base Socket.IO WebSocket target URL. |

---

## 🛠️ Local Development Setup

### Prerequisites
- **Python**: `3.10+`
- **Node.js**: `v18+` and `npm`

### 1. Backend Setup

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the backend server
python app.py
```

`app.py` automatically runs initial Alembic database migrations (`alembic upgrade head`) and launches Uvicorn on `http://localhost:8000`.

### 2. Frontend Setup

```bash
cd frontend

# 1. Install node dependencies
npm install

# 2. Start the Vite development server
npm run dev
```

The app will be accessible at `http://localhost:5173`.  
Vite's proxy configured in `vite.config.js` will route all `/api/*` and `/socket.io/*` requests directly to `http://localhost:8000`.

---

## ☁️ Production Deployment

### 1. Backend Deployment (Render)

The backend runs as a Python Web Service on Render.

#### Option A: Automatic Setup using `render.yaml`
1. Connect your repository to Render.
2. Select **Blueprint** and select `backend/render.yaml`.
3. Fill in the managed **DATABASE_URL** and **REDIS_URL** in the Render Dashboard.

#### Option B: Manual Web Service Setup
- **Environment**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python app.py` (Applies `alembic upgrade head` then starts Uvicorn)
- **Health Check Path**: `/health`

#### Required Environment Variables in Render Dashboard:
```env
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:5432/<dbname>
REDIS_URL=redis://:<password>@<host>:<port>
CORS_ORIGINS=["https://your-vercel-domain.vercel.app"]
WEB_CONCURRENCY=1
```

---

### 2. Frontend Deployment (Vercel)

1. Import the `frontend` folder/repository into Vercel.
2. Set Framework Preset: **Vite**
3. Ensure `frontend/.env.production` has your production backend URL:
   ```env
   VITE_API_URL=https://your-render-backend.onrender.com
   VITE_WS_URL=https://your-render-backend.onrender.com
   ```
4. Build Command: `npm run build`
5. Output Directory: `dist`

The included `vercel.json` file ensures single-page application routing (`rewrites`) and strict security headers (`X-Frame-Options`, `X-Content-Type-Options`).

---

## 🧪 Verification & Health Checks

Once deployed, verify the installation by testing these endpoints:

| Endpoint | Method | Expected Status | Purpose |
| :--- | :---: | :---: | :--- |
| `/ping` | `GET` | `200 OK` (`{"status": "ok"}`) | Instant liveness check (no DB dependency). |
| `/health` | `GET` | `200 OK` (`{"status": "ok", "db": true}`) | Deep health check (tests DB & Redis status). |
| `/api/stats` | `GET` | `200 OK` | Returns total satellites, active conjunction count, and scan timestamp. |
