from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from redis.asyncio import Redis
from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.conjunction import ConjunctionModel
from app.services.conjunction import scan_conjunctions, get_satellite_name, get_satellite_type
from app.services.tle_ingest import ingest_satellites

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
last_scan_at: datetime | None = None
redis_client: Redis | None = None


def configure_scheduler(redis: Redis | None = None) -> None:
    global redis_client
    redis_client = redis


async def run_conjunction_scan() -> None:
    """Run a full conjunction scan and atomically replace the conjunctions table.

    Safety guarantee: the DELETE only happens AFTER a successful scan.
    If the scan raises an exception, existing data is preserved.
    Synthetic conjunctions are only seeded in non-production environments.
    """
    global last_scan_at
    try:
        async with AsyncSessionLocal() as session:
            # ── 1. Run the scan FIRST ──────────────────────────────────────────
            conjunctions = await scan_conjunctions(session)

            # ── 2. Optionally seed synthetic data in dev/staging only (Disabled) ─
            pass

            # ── 3. Atomically replace conjunctions table only if scan succeeded ─
            await session.execute(delete(ConjunctionModel))
            session.add_all(conjunctions)
            await session.commit()

            # Refresh to get DB-assigned IDs
            for c in conjunctions:
                try:
                    await session.refresh(c)
                except Exception:
                    pass

            # ── 4. Update scan timestamp (UTC-aware) ───────────────────────────
            last_scan_at = datetime.now(timezone.utc)

            # ── 5. Publish HIGH-risk alerts ────────────────────────────────────
            high_risk = [c for c in conjunctions if c.risk_level == "HIGH"]
            sat_map: dict[str, tuple[str, str]] = {}
            if high_risk:
                norad_ids = {c.sat1_norad_id for c in high_risk} | {c.sat2_norad_id for c in high_risk}
                from app.models.satellite import SatelliteModel
                sat_stmt = select(
                    SatelliteModel.norad_id,
                    SatelliteModel.name,
                    SatelliteModel.object_type,
                ).where(SatelliteModel.norad_id.in_(list(norad_ids)))
                sat_result = await session.execute(sat_stmt)
                sat_map = {row[0]: (row[1], row[2]) for row in sat_result.all()}

            for conjunction in conjunctions:
                if conjunction.risk_level != "HIGH":
                    continue

                sat1_name, sat1_type = sat_map.get(conjunction.sat1_norad_id) or (
                    await get_satellite_name(session, conjunction.sat1_norad_id),
                    await get_satellite_type(session, conjunction.sat1_norad_id),
                )
                sat2_name, sat2_type = sat_map.get(conjunction.sat2_norad_id) or (
                    await get_satellite_name(session, conjunction.sat2_norad_id),
                    await get_satellite_type(session, conjunction.sat2_norad_id),
                )

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
                    await redis_client.publish(
                        "new_alerts",
                        json.dumps({"type": "new_alert", "data": alert_payload}),
                    )
                else:
                    try:
                        from app.websocket.stream import sio
                        await sio.emit("new_alert", alert_payload)
                    except Exception:
                        pass

            # Notify frontend of updated conjunction count
            try:
                from app.websocket.stream import sio
                await sio.emit("conjunctions_updated", {"count": len(conjunctions)})
            except Exception:
                pass

            logger.info("Conjunction scan completed: %d active alerts", len(conjunctions))

    except Exception:
        logger.exception("Conjunction scan failed")


async def run_tle_ingest() -> None:
    """Scheduled task to fetch latest TLEs from CelesTrak and trigger a conjunction scan."""
    try:
        async with AsyncSessionLocal() as session:
            logger.info("Scheduled job: Fetching latest TLEs from CelesTrak...")
            count = await ingest_satellites(session)
            logger.info("Scheduled job: Satellite ingestion complete. Ingested %d records.", count)
        # Run conjunction scan after ingestion
        await run_conjunction_scan()
    except Exception:
        logger.exception("Scheduled TLE ingestion failed")


async def run_refresh_flow() -> None:
    """Ingest fresh TLEs from CelesTrak, run conjunction scan, and trigger broadcast."""
    try:
        async with AsyncSessionLocal() as session:
            logger.info("Manual refresh: Ingesting satellites from CelesTrak...")
            await ingest_satellites(session)
            logger.info("Manual refresh: Satellite ingestion complete. Running conjunction scan...")
        # Run conjunction scan
        await run_conjunction_scan()
        # Trigger an immediate position broadcast to Socket.IO clients
        try:
            from app.websocket.stream import trigger_immediate_broadcast
            trigger_immediate_broadcast()
        except Exception:
            pass
    except Exception:
        logger.exception("Manual refresh flow failed")


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(
            run_conjunction_scan,
            "interval",
            minutes=5,
            id="conjunction_scan",
            replace_existing=True,
        )
        scheduler.add_job(
            run_tle_ingest,
            "interval",
            hours=6,
            id="tle_ingest",
            replace_existing=True,
        )
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
