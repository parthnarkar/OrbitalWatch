from __future__ import annotations

import logging

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.satellite import SatelliteModel

logger = logging.getLogger(__name__)

CELESTRAK_GROUPS: tuple[str, ...] = (
    "weather",
    "gps-ops",
    "amateur",
    "visual",
    "stations",
    "iridium-33-debris",
    "cosmos-2251-debris",
    "fengyun-1c-debris",
    "cosmos-1408-debris",
    "geo",
)

DEBRIS_CATEGORIES: frozenset[str] = frozenset({
    "iridium-33-debris",
    "cosmos-2251-debris",
    "fengyun-1c-debris",
    "cosmos-1408-debris",
})


async def fetch_tle_from_celestrak(category: str) -> list[dict[str, str]]:
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={category}&FORMAT=TLE"
    logger.debug("Fetching CelesTrak URL: %s", url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning(
            "Failed to fetch TLEs for category %s: %s (continuing)", category, exc,
        )
        return []

    logger.debug("CelesTrak HTTP %s for category '%s'", response.status_code, category)
    if "Invalid query" in response.text:
        logger.warning("CelesTrak error for '%s': %s", category, response.text.strip())

    lines = [line.strip() for line in response.text.splitlines() if line.strip()]
    records: list[dict[str, str]] = []
    index = 0
    while index + 2 < len(lines):
        name = lines[index]
        line1 = lines[index + 1]
        line2 = lines[index + 2]
        if not (line1.startswith("1 ") and line2.startswith("2 ")):
            index += 1
            continue
        norad_id = line1[2:7].strip()
        records.append({"name": name, "line1": line1, "line2": line2, "norad_id": norad_id})
        index += 3

    logger.info("Category '%s': fetched %d records from CelesTrak", category, len(records))
    return records


# ── Object Type Helper ─────────────────────────────────────────────────────────

def determine_object_type(name: str, category: str) -> str:
    name_upper = name.upper()
    cat_lower = category.lower()
    if "R/B" in name_upper or "ROCKET BODY" in name_upper or "BOOSTER" in name_upper:
        return "rocket body"
    if "DEB" in name_upper or "DEBRIS" in name_upper or "FRAG" in name_upper or "debris" in cat_lower:
        return "debris"
    if "UNKNOWN" in name_upper or "UNIDENTIFIED" in name_upper:
        return "unknown"
    return "payload"


# ── Ingest Satellites Entrypoint ───────────────────────────────────────────────

async def ingest_satellites(db_session: AsyncSession) -> int:
    """Fetch real TLEs from CelesTrak and upsert into the database.

    - Real TLE lines (line1/line2) from CelesTrak are stored exactly as received.
    - Uses bulk NORAD ID fetch to avoid N+1 SELECT per record.
    """
    ingested_count = 0
    category_limits = {
        "weather": 50, "gps-ops": 50, "amateur": 50,
        "visual": 150, "stations": 50,
        "iridium-33-debris": 100, "cosmos-2251-debris": 100,
        "fengyun-1c-debris": 100, "cosmos-1408-debris": 100, "geo": 100,
    }

    for category in CELESTRAK_GROUPS:
        try:
            tle_records = await fetch_tle_from_celestrak(category)
        except Exception:
            logger.exception("Unexpected error fetching category %s", category)
            continue

        if not tle_records:
            continue

        batch = tle_records[:category_limits.get(category, 100)]
        batch_norad_ids = [r["norad_id"] for r in batch]

        # ── Bulk-fetch all existing satellites for this batch (single query) ──
        existing_result = await db_session.execute(
            select(SatelliteModel).where(SatelliteModel.norad_id.in_(batch_norad_ids))
        )
        existing_map: dict[str, SatelliteModel] = {
            sat.norad_id: sat for sat in existing_result.scalars().all()
        }

        for record in batch:
            try:
                object_type = (
                    "debris" if category in DEBRIS_CATEGORIES
                    else determine_object_type(record["name"], category)
                )

                # ── Store REAL TLE data exactly as received from CelesTrak ──────
                real_line1 = record["line1"]
                real_line2 = record["line2"]

                satellite = existing_map.get(record["norad_id"])
                if satellite is None:
                    db_session.add(SatelliteModel(
                        norad_id=record["norad_id"],
                        name=record["name"],
                        object_type=object_type,
                        tle_line1=real_line1,
                        tle_line2=real_line2,
                    ))
                else:
                    satellite.name = record["name"]
                    satellite.object_type = object_type
                    satellite.tle_line1 = real_line1
                    satellite.tle_line2 = real_line2
                ingested_count += 1
            except Exception:
                logger.exception(
                    "Error processing record %s in category %s",
                    record.get("norad_id"), category,
                )

    await db_session.commit()
    logger.info("Satellite ingestion completed: %d records updated/inserted from CelesTrak", ingested_count)
    return ingested_count
