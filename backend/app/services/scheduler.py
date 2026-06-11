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
from app.services.conjunction import scan_conjunctions, get_satellite_name, get_satellite_type

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

            # Bulk query satellite metadata for high-risk alerts to avoid loop queries
            high_risk_conjs = [c for c in conjunctions if c.risk_level == "HIGH"]
            sat_map = {}
            if high_risk_conjs:
                norad_ids = set()
                for c in high_risk_conjs:
                    norad_ids.add(c.sat1_norad_id)
                    norad_ids.add(c.sat2_norad_id)
                from app.models.satellite import SatelliteModel
                from sqlalchemy import select
                sat_stmt = select(SatelliteModel.norad_id, SatelliteModel.name, SatelliteModel.object_type).where(
                    SatelliteModel.norad_id.in_(list(norad_ids))
                )
                sat_result = await session.execute(sat_stmt)
                sat_map = {row[0]: (row[1], row[2]) for row in sat_result.all()}

            for conjunction in conjunctions:
                if conjunction.risk_level == "HIGH":
                    if conjunction.sat1_norad_id in sat_map:
                        sat1_name, sat1_type = sat_map[conjunction.sat1_norad_id]
                    else:
                        sat1_name = await get_satellite_name(session, conjunction.sat1_norad_id)
                        sat1_type = await get_satellite_type(session, conjunction.sat1_norad_id)

                    if conjunction.sat2_norad_id in sat_map:
                        sat2_name, sat2_type = sat_map[conjunction.sat2_norad_id]
                    else:
                        sat2_name = await get_satellite_name(session, conjunction.sat2_norad_id)
                        sat2_type = await get_satellite_type(session, conjunction.sat2_norad_id)

                    alert_payload = {
                        "id": conjunction.id,
                        "sat1_norad_id": conjunction.sat1_norad_id,
                        "sat1_name": sat1_name,
                        "sat1_type": sat1_type,
                        "sat2_norad_id": conjunction.sat2_norad_id,
                        "sat2_name": sat2_name,
                        "sat2_type": sat2_type,
                        "approach_time": conjunction.approach_time.isoformat(),
                        "miss_distance_km": conjunction.miss_distance_km,
                        "risk_level": conjunction.risk_level,
                        "probability": conjunction.probability,
                        "relative_velocity": conjunction.relative_velocity,
                    }

                    if redis_client is not None:
                        payload = {
                            "type": "new_alert",
                            "data": alert_payload
                        }
                        await redis_client.publish("new_alerts", json.dumps(payload))
                    else:
                        try:
                            from app.websocket.stream import sio
                            await sio.emit("new_alert", alert_payload)
                        except Exception:
                            logger.exception("Failed to emit fallback new_alert")
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
