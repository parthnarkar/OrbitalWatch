from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from redis.asyncio import Redis
from sqlalchemy import func, select, text

from app.api.conjunctions import router as conjunctions_router
from app.api.propagate import router as propagate_router
from app.api.satellites import router as satellites_router
from app.api.rescan import router as rescan_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.models.conjunction import ConjunctionModel
from app.models.satellite import SatelliteModel
from app.services import scheduler
from app.services.scheduler import configure_scheduler, start_scheduler, stop_scheduler, run_conjunction_scan
from app.services.tle_ingest import ingest_satellites
from app.websocket.stream import broadcast_positions, listen_for_alerts, sio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

redis_client: Redis | None = None
background_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global redis_client
    await init_db()
    try:
        async with AsyncSessionLocal() as session:
            ingested = await ingest_satellites(session)
            logger.info("Initial satellite ingestion completed: %s records", ingested)
    except Exception:  # pragma: no cover - startup safety net
        logger.exception("Initial satellite ingestion failed")

    try:
        redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=False)
        await redis_client.ping()
        configure_scheduler(redis_client)
    except Exception as exc:
        logger.warning("Redis unavailable at startup (%s); continuing without alert pub/sub", exc)
        redis_client = None
        configure_scheduler(None)

    start_scheduler()
    background_tasks.append(asyncio.create_task(run_conjunction_scan()))
    background_tasks.append(asyncio.create_task(broadcast_positions()))
    background_tasks.append(asyncio.create_task(listen_for_alerts(redis_client)))
    try:
        yield
    finally:
        stop_scheduler()
        for task in background_tasks:
            task.cancel()
        await asyncio.gather(*background_tasks, return_exceptions=True)
        if redis_client is not None:
            await redis_client.aclose()


app = FastAPI(title="OrbitalWatch API", version="1.0.0", lifespan=lifespan)

# Wildcard origins do not allow credentials in FastAPI CORSMiddleware
allow_credentials = True
if "*" in settings.CORS_ORIGINS:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(satellites_router)
app.include_router(propagate_router)
app.include_router(conjunctions_router)
app.include_router(rescan_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to the OrbitalWatch API"}


@app.get("/health")
async def health_check() -> dict[str, object]:
    db_ok = False
    redis_ok = False
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        logger.exception("Health DB check failed")
    try:
        if redis_client is not None:
            redis_ok = bool(await redis_client.ping())
    except Exception:
        logger.exception("Health Redis check failed")
    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "redis": redis_ok,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/stats")
async def stats() -> dict[str, object]:
    async with AsyncSessionLocal() as session:
        total_satellites = await session.scalar(select(func.count(SatelliteModel.id)))
        debris_count = await session.scalar(
            select(func.count(SatelliteModel.id)).where(SatelliteModel.object_type == "debris")
        )
        active_conjunctions = await session.scalar(select(func.count(ConjunctionModel.id)))
        high_risk_count = await session.scalar(
            select(func.count(ConjunctionModel.id)).where(ConjunctionModel.risk_level == "HIGH")
        )
    return {
        "total_satellites": total_satellites or 0,
        "debris_count": debris_count or 0,
        "total_debris": debris_count or 0,
        "active_conjunctions": active_conjunctions or 0,
        "high_risk_count": high_risk_count or 0,
        "last_scan": scheduler.last_scan_at.isoformat() if scheduler.last_scan_at else None,
        "last_updated": int(datetime.now(timezone.utc).timestamp() * 1000),
    }


socket_app = socketio.ASGIApp(sio, app)
