from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.satellites import router as satellites_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.services.tle_ingest import ingest_satellites

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await init_db()
    try:
        async with AsyncSessionLocal() as session:
            ingested = await ingest_satellites(session)
            logger.info("Initial satellite ingestion completed: %s records", ingested)
    except Exception:  # pragma: no cover - startup safety net
        logger.exception("Initial satellite ingestion failed")
    yield


app = FastAPI(title="OrbitalWatch API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(satellites_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
