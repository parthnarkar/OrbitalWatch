from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from redis.asyncio import Redis
from sqlalchemy import delete

from app.core.database import AsyncSessionLocal
from app.models.conjunction import ConjunctionModel
from app.services.conjunction import scan_conjunctions

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
last_scan_at: datetime | None = None
redis_client: Redis | None = None


def configure_scheduler(redis: Redis | None = None) -> None:
    global redis_client
    redis_client = redis


async def run_conjunction_scan() -> None:
    global last_scan_at
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(delete(ConjunctionModel))
            conjunctions = await scan_conjunctions(session)
            session.add_all(conjunctions)
            await session.commit()
            last_scan_at = datetime.now(timezone.utc)

            if redis_client is not None:
                for conjunction in conjunctions:
                    if conjunction.risk_level == "HIGH":
                        payload: dict[str, Any] = {
                            "type": "new_alert",
                            "data": {
                                "sat1_norad_id": conjunction.sat1_norad_id,
                                "sat2_norad_id": conjunction.sat2_norad_id,
                                "approach_time": conjunction.approach_time.isoformat(),
                                "miss_distance_km": conjunction.miss_distance_km,
                                "risk_level": conjunction.risk_level,
                                "probability": conjunction.probability,
                            },
                        }
                        await redis_client.publish("new_alerts", json.dumps(payload))
            logger.info("Conjunction scan completed: %s active alerts", len(conjunctions))
    except Exception:
        logger.exception("Conjunction scan failed")


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(run_conjunction_scan, "interval", minutes=5, id="conjunction_scan", replace_existing=True)
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
