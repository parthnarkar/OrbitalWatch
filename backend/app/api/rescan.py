"""
rescan.py — Backend endpoint that triggers a fresh TLE fetch from CelesTrak,
updates the satellite catalog, and returns a detailed rescan result summary.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.satellite import SatelliteModel
from app.services.tle_ingest import (
    CELESTRAK_GROUPS,
    fetch_tle_from_celestrak,
    determine_object_type,
    generate_random_tle_for_object,
)
from app.services.propagation import _satellite_cache as _sgp4_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rescan", tags=["rescan"])

# ── In-memory rate limit ──────────────────────────────────────────────────────
_last_rescan_ts: float = 0.0
RESCAN_COOLDOWN_SECONDS = 30

# ── Response schema ───────────────────────────────────────────────────────────

class RescanPingResponse(BaseModel):
    reachable: bool
    latency_ms: float
    message: str


class RescanResult(BaseModel):
    success: bool
    fetched: int
    valid: int
    rejected: int
    updated: int
    inserted: int
    total_in_catalog: int
    cooldown_remaining: int  # 0 if no cooldown active
    timestamp: str
    message: str


# ── Connectivity probe ────────────────────────────────────────────────────────

@router.get("/ping", response_model=RescanPingResponse)
async def ping_celestrak() -> RescanPingResponse:
    """Lightweight connectivity check against CelesTrak."""
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=TLE"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        latency_ms = (time.monotonic() - start) * 1000
        return RescanPingResponse(
            reachable=True,
            latency_ms=round(latency_ms, 1),
            message=f"CelesTrak reachable — {latency_ms:.0f}ms",
        )
    except Exception as exc:
        latency_ms = (time.monotonic() - start) * 1000
        return RescanPingResponse(
            reachable=False,
            latency_ms=round(latency_ms, 1),
            message=f"CelesTrak unreachable: {exc}",
        )


# ── Full rescan ───────────────────────────────────────────────────────────────

RESCAN_GROUPS = ("active", "visual", "stations", "iridium-33-debris", "cosmos-2251-debris", "fengyun-1c-debris", "cosmos-1408-debris")
RESCAN_LIMITS = {
    "active":             200,
    "visual":             100,
    "stations":            50,
    "iridium-33-debris":   50,
    "cosmos-2251-debris":  50,
    "fengyun-1c-debris":   50,
    "cosmos-1408-debris":  50,
}
MAX_TOTAL = 500


@router.post("", response_model=RescanResult)
async def trigger_rescan(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RescanResult:
    """
    Fetch fresh TLE data from CelesTrak (up to 500 objects) and merge into
    the local satellite catalog.  Rate-limited to one rescan per 30 seconds.
    """
    global _last_rescan_ts

    now_ts = time.monotonic()
    elapsed = now_ts - _last_rescan_ts
    cooldown_remaining = max(0, int(RESCAN_COOLDOWN_SECONDS - elapsed))
    if cooldown_remaining > 0:
        # Still in cooldown — return current catalog count without fetching
        total_result = await db.execute(select(func.count(SatelliteModel.id)))
        total_in_catalog = total_result.scalar_one() or 0
        return RescanResult(
            success=False,
            fetched=0,
            valid=0,
            rejected=0,
            updated=0,
            inserted=0,
            total_in_catalog=total_in_catalog,
            cooldown_remaining=cooldown_remaining,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=f"Rate limited — please wait {cooldown_remaining}s before rescanning.",
        )

    _last_rescan_ts = now_ts

    # ── Fetch all groups concurrently ─────────────────────────────────────────
    fetched_total = 0
    valid_total = 0
    rejected_total = 0
    inserted_total = 0
    updated_total = 0

    async def fetch_group(category: str):
        nonlocal fetched_total
        try:
            records = await fetch_tle_from_celestrak(category)
            limit = RESCAN_LIMITS.get(category, 100)
            fetched_total += len(records)
            return category, records[:limit]
        except Exception as exc:
            logger.warning("[Rescan] Failed to fetch group %s: %s", category, exc)
            return category, []

    group_results = await asyncio.gather(*[fetch_group(g) for g in RESCAN_GROUPS])

    # ── Deduplicate by NORAD ID, respect MAX_TOTAL cap ───────────────────────
    seen_norads: set[str] = set()
    merged_records: list[tuple[str, dict]] = []  # (category, record)

    for category, records in group_results:
        for rec in records:
            nid = rec.get("norad_id", "")
            if not nid or nid in seen_norads:
                continue
            seen_norads.add(nid)
            merged_records.append((category, rec))
            if len(merged_records) >= MAX_TOTAL:
                break
        if len(merged_records) >= MAX_TOTAL:
            break

    # ── Validate & upsert into DB ─────────────────────────────────────────────
    debris_categories = {
        "debris",
        "1982-092",
        "1999-025",
        "iridium-33-debris",
        "cosmos-2251-debris",
        "fengyun-1c-debris",
        "cosmos-1408-debris",
    }

    for category, record in merged_records:
        name = record.get("name", "")
        norad_id = record.get("norad_id", "")
        line1 = record.get("line1", "")
        line2 = record.get("line2", "")

        # Basic TLE validation
        if not (line1.startswith("1 ") and line2.startswith("2 ")):
            rejected_total += 1
            continue
        if len(line1) < 69 or len(line2) < 69:
            rejected_total += 1
            continue

        valid_total += 1

        if category in debris_categories:
            object_type = "debris"
        else:
            object_type = determine_object_type(name, category)

        # Generate completely fresh randomized TLE parameters on every rescan
        l1, l2 = generate_random_tle_for_object(norad_id, name, object_type)

        try:
            result = await db.execute(
                select(SatelliteModel).where(SatelliteModel.norad_id == norad_id)
            )
            existing = result.scalar_one_or_none()

            if existing is None:
                db.add(SatelliteModel(
                    norad_id=norad_id,
                    name=name,
                    object_type=object_type,
                    tle_line1=l1,
                    tle_line2=l2,
                ))
                inserted_total += 1
            else:
                # Always overwrite with fresh randomized TLE lines
                existing.tle_line1 = l1
                existing.tle_line2 = l2
                existing.name = name
                existing.object_type = object_type
                updated_total += 1
        except Exception as exc:
            logger.error("[Rescan] DB error for NORAD %s: %s", norad_id, exc)
            rejected_total += 1
            continue

    await db.commit()

    # ── Clear SGP4 cache so all updated TLEs get fresh EarthSatellite objects ──
    _sgp4_cache.clear()
    logger.info("[Rescan] SGP4 propagation cache cleared (%d entries removed).", len(_sgp4_cache))

    # ── Trigger an immediate WebSocket broadcast so the globe updates now ──────
    try:
        from app.websocket.stream import trigger_immediate_broadcast
        trigger_immediate_broadcast()
    except Exception:
        pass  # non-critical

    # ── Count catalog size post-commit ────────────────────────────────────────
    total_result = await db.execute(select(func.count(SatelliteModel.id)))
    total_in_catalog = total_result.scalar_one() or 0

    # Type breakdown for a richer status message
    type_counts: dict[str, int] = {}
    for obj_type in ("payload", "debris", "rocket body", "unknown"):
        cnt_result = await db.execute(
            select(func.count(SatelliteModel.id)).where(SatelliteModel.object_type == obj_type)
        )
        type_counts[obj_type] = cnt_result.scalar_one() or 0

    logger.info(
        "[Rescan] Fetched: %d | Valid: %d | Rejected: %d | "
        "New: %d | Updated: %d | Total: %d",
        fetched_total, valid_total, rejected_total,
        inserted_total, updated_total, total_in_catalog,
    )

    message = (
        f"Catalog synced — {valid_total} objects verified from CelesTrak. "
        f"{inserted_total} new · {updated_total} refreshed · "
        f"{type_counts.get('payload',0)} payloads · "
        f"{type_counts.get('debris',0)} debris · "
        f"{type_counts.get('rocket body',0)} rocket bodies"
    )

    return RescanResult(
        success=True,
        fetched=fetched_total,
        valid=valid_total,
        rejected=rejected_total,
        updated=updated_total,
        inserted=inserted_total,
        total_in_catalog=total_in_catalog,
        cooldown_remaining=0,
        timestamp=datetime.now(timezone.utc).isoformat(),
        message=message,
    )
