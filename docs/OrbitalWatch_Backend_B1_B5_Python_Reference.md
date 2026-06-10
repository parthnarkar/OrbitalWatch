=== START PROMPT B1 (Python - no changes needed, already Python) ===
Create a complete FastAPI backend project for "OrbitalWatch" with the exact structure and specifications below. This must be production-ready, fully typed, and error-free.

PROJECT STRUCTURE (create all these files):
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── satellite.py
│   │   └── conjunction.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── satellites.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── tle_ingest.py
│   └── schemas/
│       ├── __init__.py
│       └── satellite.py
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
└── seed.py
```

REQUIREMENTS.TXT (exact versions):
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
redis==5.0.8
python-dotenv==1.0.1
pydantic==2.9.0
pydantic-settings==2.5.0
httpx==0.27.0
alembic==1.13.0
```

1. app/core/config.py:
   - Use pydantic-settings BaseSettings
   - Fields: DATABASE_URL (default: postgresql+asyncpg://orbital:orbital@localhost:5432/orbitalwatch), REDIS_URL (default: redis://localhost:6379/0), CORS_ORIGINS (default: ["http://localhost:5173"])
   - Load from .env file

2. app/core/database.py:
   - Async engine using create_async_engine
   - AsyncSessionLocal using async_sessionmaker
   - Base = declarative_base()
   - get_db() async generator yielding AsyncSession
   - init_db() async function that runs Base.metadata.create_all()

3. app/models/satellite.py:
   - Table: satellites
   - Columns: id (Integer, PK), norad_id (String(10), unique, index), name (String(100)), object_type (String(20)), tle_line1 (String(80)), tle_line2 (String(80)), created_at (DateTime, default=utcnow), updated_at (DateTime, default=utcnow)
   - object_type enum values: "payload", "debris", "rocket body", "unknown"

4. app/models/conjunction.py:
   - Table: conjunctions
   - Columns: id (Integer, PK), sat1_norad_id (String(10), index), sat2_norad_id (String(10), index), approach_time (DateTime), miss_distance_km (Float), risk_level (String(10)), probability (Float, default=0.0), created_at (DateTime, default=utcnow)
   - risk_level values: "LOW", "MEDIUM", "HIGH"

5. app/schemas/satellite.py:
   - SatelliteBase: norad_id, name, object_type, tle_line1, tle_line2
   - SatelliteCreate inherits SatelliteBase
   - SatelliteResponse inherits SatelliteBase + id, created_at
   - PositionResponse: norad_id, name, timestamp (datetime), latitude, longitude, altitude_km, velocity_kms, orbital_period_min, object_type
   - ConjunctionResponse: id, sat1_norad_id, sat1_name, sat2_norad_id, sat2_name, approach_time, miss_distance_km, risk_level, probability

6. app/api/satellites.py:
   - Router prefix: /api/satellites
   - GET / → list all satellites (async, uses get_db)
   - GET /{norad_id} → get single satellite by norad_id
   - GET /search?q={query} → search by name (case-insensitive ILIKE, limit 20)
   - All endpoints return Pydantic models
   - Handle 404 with HTTPException

7. app/services/tle_ingest.py:
   - Function: fetch_tle_from_celestrak(category: str) -> list[dict]
   - URL: https://celestrak.org/NORAD/elements/gp.php?GROUP={category}&FORMAT=TLE
   - Categories to fetch: "active", "visual", "stations", "debris"
   - Parse TLE lines: name (line 0), line1, line2
   - Function: ingest_satellites(db_session) -> int (count ingested)
   - Skip duplicates by norad_id (update existing TLE if changed)
   - Set object_type based on category: "debris" for debris group, "payload" for active/visual/stations

8. app/main.py:
   - FastAPI app with title="OrbitalWatch API", version="1.0.0"
   - CORS middleware: allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
   - Include satellites router
   - Startup event: init_db() + ingest_satellites()
   - Health check endpoint: GET /health → {"status": "ok"}

9. docker-compose.yml:
   - Services: postgres (image: postgres:16-alpine, ports 5432:5432, env POSTGRES_USER=orbital, POSTGRES_PASSWORD=orbital, POSTGRES_DB=orbitalwatch), redis (image: redis:7-alpine, ports 6379:6379)
   - Volumes: postgres_data, redis_data

10. Dockerfile:
    - Python 3.11 slim
    - WORKDIR /app
    - COPY requirements.txt + install
    - COPY app/ ./app/
    - CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

11. .env.example:
    - DATABASE_URL=postgresql+asyncpg://orbital:orbital@localhost:5432/orbitalwatch
    - REDIS_URL=redis://localhost:6379/0
    - CORS_ORIGINS=["http://localhost:5173"]

12. seed.py (standalone script):
    - Async main() that creates engine, creates tables, ingests satellites
    - Prints count of satellites ingested
    - if __name__ == "__main__": asyncio.run(main())

CRITICAL RULES:
- Use SQLAlchemy 2.0 style (mapped_column, select(), not query())
- All DB operations must be async (async_session, await session.execute())
- Use TypeHints everywhere
- No mock data. Must fetch real TLEs from CelesTrak.
- Handle network errors gracefully with try/except in tle_ingest
- Do NOT create any propagation or conjunction logic in this prompt. Only scaffold + ingestion.
=== END PROMPT B1 ===

=== START PROMPT B2 (Python - no changes needed, already Python) ===
Add SGP4 orbital propagation to the existing OrbitalWatch FastAPI project. The project structure from Prompt B1 already exists. Create/modify only the files listed below.

1. Add to requirements.txt (append these lines):
```
skyfield==1.49
```

2. Create app/services/propagation.py:
   - Load skyfield Timescale ONCE at module level: ts = load.timescale()
   - Load Earth satellite data ONCE: planets = load('de421.bsp'), earth = planets['earth']
   - Function: propagate_satellite(satellite: SatelliteModel, timestamp: datetime | None = None) -> dict
   - If timestamp is None, use datetime.now(timezone.utc)
   - Parse TLE lines using skyfield EarthSatellite(tle_line1, tle_line2, name, ts)
   - Compute geocentric position at timestamp
   - Convert to lat/lon/altitude using .subpoint()
   - Calculate velocity using .at(t).velocity.km_per_s (magnitude of velocity vector)
   - Calculate orbital period using satellite.model.no_kozai (rad/min) → period = 2π / no_kozai in minutes
   - Return dict with: latitude (float), longitude (float), altitude_km (float), velocity_kms (float), orbital_period_min (float), timestamp (ISO string)
   - Handle invalid TLE gracefully: return None and log error
   - CRITICAL: Do NOT download de421.bsp if missing. Instead, use skyfield built-in loader with builtin=True or handle gracefully. If de421.bsp is not available, use skyfield's almanac or topocentric math without planetary ephemeris. The key requirement is lat/lon/alt from SGP4.

3. Create app/api/propagate.py:
   - Router prefix: /api/propagate
   - GET /{norad_id}:
     * Fetch satellite from DB by norad_id (404 if missing)
     * Call propagate_satellite(satellite)
     * Return PositionResponse schema:
       {
         "norad_id": str,
         "name": str,
         "timestamp": str (ISO 8601),
         "position": {
           "latitude": float,
           "longitude": float,
           "altitude_km": float,
           "velocity_kms": float
         },
         "orbital_period_min": float,
         "object_type": str
       }
   - Optional query param: ?at=2026-06-14T10:00:00Z (propagate to specific time)

4. Modify app/main.py:
   - Import and include the propagate router
   - Add startup event to download skyfield data files if needed (use load() with builtin=True or check file existence)

5. Create a test script tests/test_propagation.py:
   - Test ISS propagation (NORAD 25544)
   - Assert altitude is between 400 and 420 km
   - Assert velocity is between 7.5 and 7.8 km/s
   - Use pytest-asyncio

CRITICAL RULES:
- Skyfield's EarthSatellite.subpoint() gives lat/lon/altitude directly. Use that.
- Velocity = sqrt(vx² + vy² + vz²) from .velocity.km_per_s
- All times must be timezone-aware (UTC)
- Do NOT use the sgp4 library directly. Use skyfield's wrapper.
- The endpoint must return in < 200ms for cached TLEs.
=== END PROMPT B2 ===

=== START PROMPT B3 (Python - no changes needed, already Python) ===
Add conjunction detection (collision prediction) to the existing OrbitalWatch FastAPI project. Build on top of Prompts B1 and B2.

1. Create app/services/conjunction.py:
   - Function: scan_conjunctions(db_session, hours_ahead: int = 72, interval_minutes: int = 10) -> list[ConjunctionModel]
   - Algorithm:
     a) Fetch all satellites from DB (limit to those with valid TLE)
     b) For each satellite, propagate to current time to get current altitude
     c) PRE-FILTER: Create altitude bands (0-500km, 500-1000km, 1000-2000km, 2000km+). Only compare satellites in the SAME or ADJACENT bands. This reduces pairs by ~80%.
     d) For each remaining pair (satA, satB):
        - Propagate both positions at intervals: now, now+10min, now+20min ... up to hours_ahead
        - At each interval, calculate Euclidean distance in 3D space (km):
          * Convert lat/lon/alt to Cartesian x,y,z using standard geocentric conversion
          * distance = sqrt((x1-x2)² + (y1-y2)² + (z1-z2)²)
        - Track minimum distance across all intervals
     e) If min_distance < 5.0 km:
        - Calculate relative_velocity = |vA - vB| at closest approach time
        - Calculate probability = (hard_body_radius / miss_distance)² * min(1.0, relative_velocity / 15.0)
          where hard_body_radius = 0.005 km (5 meters default, or sum of both object radii if known)
        - risk_level:
          HIGH if miss_distance < 0.1 km (100m)
          MEDIUM if miss_distance < 0.5 km (500m)
          LOW if miss_distance < 1.0 km (1000m)
          else skip (don't store)
        - Create ConjunctionModel and add to results
   - Function: get_satellite_name(db_session, norad_id) -> str (helper)
   - CRITICAL PERFORMANCE: Use coarse interval (10 min) for initial scan. For pairs with min_distance < 1km, re-scan at 1-minute intervals for accuracy.
   - Use asyncio.gather to propagate satellites in parallel batches (batch size 50)

2. Create app/api/conjunctions.py:
   - Router prefix: /api/conjunctions
   - GET / → list all active conjunctions from DB
     * Query params: risk_level (filter), hours_ahead (default 72), limit (default 100)
     * Order by approach_time ascending
   - GET /{conjunction_id} → single conjunction detail
   - DELETE /clear → clear old conjunctions (older than 24h) — for cleanup

3. Create app/services/scheduler.py:
   - Use APScheduler AsyncIOScheduler
   - Job: run_conjunction_scan() every 5 minutes
   - Steps: call scan_conjunctions() → save results to DB → publish new HIGH alerts to Redis channel "new_alerts"
   - Redis publish format: json.dumps({"type": "new_alert", "data": conjunction_dict})
   - Start scheduler in app/main.py startup event
   - Shutdown scheduler in app/main.py shutdown event

4. Modify app/main.py:
   - Import and include conjunctions router
   - Add scheduler start/stop lifecycle events
   - Add Redis client initialization on startup (redis.asyncio.Redis.from_url)

5. Create tests/test_conjunctions.py:
   - Test with 2 known close-approach satellites (use historical data or mock TLEs that are close)
   - Assert scan returns at least 1 conjunction when threshold is very large (100km)
   - Assert no conjunctions when threshold is tiny (0.001km)

CRITICAL RULES:
- The O(n²) scan must complete in < 60 seconds for 500 objects. If it takes longer, the altitude pre-filter is not working correctly.
- Do NOT store conjunctions with miss_distance >= 1.0 km. Only LOW, MEDIUM, HIGH.
- Use radians for all trigonometric calculations.
- Earth radius = 6371.0 km for Cartesian conversion.
- All DB writes in scheduler must use async session.
=== END PROMPT B3 ===

=== START PROMPT B4 (Python - no changes needed, already Python) ===
Add WebSocket live streaming to the existing OrbitalWatch FastAPI project. Build on top of Prompts B1-B3.

1. Update requirements.txt (append):
```
python-socketio==5.11.0
```

2. Create app/websocket/manager.py:
   - Class: ConnectionManager
   - Methods:
     * connect(sid, environ) → store sid in set
     * disconnect(sid) → remove sid from set
     * get_active_connections() -> set of sids
   - Use in-memory set (sufficient for MVP; Redis not needed for connection tracking)

3. Create app/websocket/stream.py:
   - sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=settings.CORS_ORIGINS)
   - Event handlers:
     * @sio.on('connect') → accept connection, emit "connected" with {"status": "ok"}
     * @sio.on('disconnect') → log disconnection
     * @sio.on('subscribe_satellites') → client can request specific NORAD IDs (optional feature)
   - Background task: broadcast_positions():
     * Runs every 60 seconds using asyncio.create_task + asyncio.sleep loop
     * Fetches all satellites from DB (limit 500)
     * For each satellite, calls propagate_satellite() to get current position
     * Builds payload: {"event": "satellite_positions", "data": [{"norad_id": "...", "name": "...", "lat": float, "lon": float, "alt": float, "type": "..."}, ...]}
     * Emits to ALL connected clients via await sio.emit('satellite_positions', payload)
     * CATCH EXCEPTIONS: if propagation fails for one satellite, skip it and continue (don't crash the broadcast)
   - Background task: listen_for_alerts():
     * Subscribes to Redis pub/sub channel "new_alerts"
     * When message received, emits to all clients via await sio.emit('new_alert', message_data)
     * Runs in separate asyncio task

4. Modify app/main.py:
   - Create socketio ASGI app: socket_app = socketio.ASGIApp(sio, app)
   - On startup:
     * Start broadcast_positions() as background task
     * Start listen_for_alerts() as background task
     * Initialize Redis pub/sub connection
   - On shutdown:
     * Cancel background tasks gracefully
     * Close Redis connection
   - The FastAPI app should still be accessible at HTTP endpoints. Mount socketio alongside.
   - IMPORTANT: Use the pattern where socketio wraps the FastAPI app, OR use separate mount. For simplicity, use:
     ```python
     from app.websocket.stream import sio
     socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
     ```
     But since uvicorn runs the FastAPI app, the cleanest way is:
     ```python
     sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=["*"])
     socket_app = socketio.ASGIApp(sio, app)
     ```
     And then uvicorn runs socket_app instead of app. Update Dockerfile CMD if needed.

5. Update Dockerfile:
   - CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
   - But ONLY if socket_app is defined in main.py. If not, keep app and mount socketio differently.
   - SAFER PATTERN: In main.py, define both:
     ```python
     app = FastAPI(...)
     # ... all routes ...
     sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=settings.CORS_ORIGINS)
     socket_app = socketio.ASGIApp(sio, app)
     ```
     Then in Dockerfile: CMD depends on which entrypoint is used. For simplicity, create a new file app/socket_entry.py that imports socket_app and run that. OR just update CMD to use app.main:socket_app.

6. Create app/websocket/__init__.py (empty)

7. Add CORS fix:
   - Ensure socketio CORS matches FastAPI CORS exactly
   - settings.CORS_ORIGINS must be a list of strings, not a JSON string

CRITICAL RULES:
- WebSocket endpoint path is implicitly /socket.io/ (Socket.IO default). Frontend connects to ws://localhost:8000
- The broadcast MUST NOT block. Use asyncio.gather for parallel propagation.
- If no clients are connected, still run broadcast (keeps cache warm) but skip emit if connections is empty.
- Redis pub/sub listener must reconnect if connection drops.
- All exceptions in background tasks must be caught and logged. Never let a background task die silently.
=== END PROMPT B4 ===

=== START PROMPT B5 (Python - no changes needed, already Python) ===
Finalize the OrbitalWatch backend for production deployment. Build on top of Prompts B1-B4.

1. Update docker-compose.yml for production:
   - Add backend service:
     * build: .
     * ports: 8000:8000
     * depends_on: postgres, redis
     * environment: DATABASE_URL, REDIS_URL (from .env)
     * restart: unless-stopped
   - Add healthcheck to postgres service
   - Use .env file loading via env_file: .env

2. Update Dockerfile for production:
   - Multi-stage build is NOT needed for hackathon (keep it simple)
   - Use python:3.11-slim
   - Install system deps: gcc, libpq-dev (for asyncpg)
   - COPY requirements.txt + pip install --no-cache-dir
   - COPY app/ ./app/
   - Create non-root user: RUN useradd -m -u 1000 orbital && chown -R orbital:orbital /app
   - USER orbital
   - EXPOSE 8000
   - CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
   - For development, keep a docker-compose.dev.yml with --reload flag

3. Create docker-compose.dev.yml:
   - Same services but backend uses command: uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload

4. Update app/main.py:
   - Add /health endpoint (already exists from B1, enhance it):
     * Check DB connectivity: execute SELECT 1
     * Check Redis connectivity: ping()
     * Return {"status": "ok", "db": true/false, "redis": true/false, "timestamp": iso_string}
   - Add /api/stats endpoint:
     * Returns {"total_satellites": int, "debris_count": int, "active_conjunctions": int, "last_scan": iso_string}

5. Create render.yaml (for Render.com deployment):
   - services: web (docker), postgres (managed), redis (managed or docker)
   - env vars: DATABASE_URL, REDIS_URL, PYTHON_VERSION=3.11

6. Create railway.json (for Railway deployment):
   - "$schema": "https://railway.app/railway.schema.json"
   - build: builder=DOCKERFILE
   - deploy: healthcheckPath=/health, restartPolicyType=ON_FAILURE

7. Update requirements.txt (ensure all pinned):
   - Add gunicorn==23.0.0 as fallback (though uvicorn is primary)

8. Create .dockerignore:
   - __pycache__, .env, *.pyc, .git, tests/

9. Create README.md (backend section):
   - Setup: docker-compose up -d
   - Dev: docker-compose -f docker-compose.dev.yml up
   - API docs: http://localhost:8000/docs
   - Health: http://localhost:8000/health

10. Final verification script verify_backend.py:
    - Makes HTTP requests to all endpoints
    - Checks: /health, /api/satellites, /api/satellites/25544, /api/propagate/25544, /api/conjunctions
    - Connects WebSocket and listens for 1 satellite_positions event
    - Prints PASS/FAIL for each check

CRITICAL RULES:
- socket_app must be importable from app.main module level
- Do NOT use --reload in production Dockerfile
- Ensure asyncpg has libpq in Docker image (install postgresql-client or libpq-dev)
- The backend must start successfully even if Redis is temporarily unavailable (retry connection)
- All secrets must come from environment variables, never hardcoded
=== END PROMPT B5 ===

=== BACKEND IS ALREADY PYTHON — NO CONVERSION NEEDED ===

The backend prompts (B1–B5) are already written in Python (FastAPI, SQLAlchemy, Pydantic, etc.).
There is no TypeScript/JavaScript to convert in the backend layer.

Key backend technologies (already Python):
- FastAPI (Python web framework)
- SQLAlchemy 2.0 (Python ORM)
- Pydantic (Python data validation)
- Skyfield (Python astronomy library)
- python-socketio (Python WebSocket library)
- APScheduler (Python job scheduler)
- asyncpg (Python async PostgreSQL driver)
- redis-py (Python Redis client)
- Uvicorn (Python ASGI server)

All files use .py extension and Python type hints (PEP 484).
No conversion from .ts/.tsx to .js/.jsx is applicable here.
