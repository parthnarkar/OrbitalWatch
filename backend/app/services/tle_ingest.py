from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.satellite import SatelliteModel

logger = logging.getLogger(__name__)

CELESTRAK_GROUPS: tuple[str, ...] = ("active", "visual", "stations", "debris")


async def fetch_tle_from_celestrak(category: str) -> list[dict[str, str]]:
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={category}&FORMAT=TLE"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.exception("Failed to fetch TLEs for category %s", category)
        return []

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
    return records


async def ingest_satellites(db_session: AsyncSession) -> int:
    ingested_count = 0
    for category in CELESTRAK_GROUPS:
        try:
            tle_records = await fetch_tle_from_celestrak(category)
        except Exception:  # pragma: no cover - network safety net
            logger.exception("Unexpected error fetching category %s", category)
            continue

        object_type = "debris" if category == "debris" else "payload"
        for record in tle_records:
            result = await db_session.execute(
                select(SatelliteModel).where(SatelliteModel.norad_id == record["norad_id"])
            )
            satellite = result.scalar_one_or_none()
            if satellite is None:
                satellite = SatelliteModel(
                    norad_id=record["norad_id"],
                    name=record["name"],
                    object_type=object_type,
                    tle_line1=record["line1"],
                    tle_line2=record["line2"],
                )
                db_session.add(satellite)
                ingested_count += 1
                continue

            changed = False
            if satellite.name != record["name"]:
                satellite.name = record["name"]
                changed = True
            if satellite.object_type != object_type:
                satellite.object_type = object_type
                changed = True
            if satellite.tle_line1 != record["line1"]:
                satellite.tle_line1 = record["line1"]
                changed = True
            if satellite.tle_line2 != record["line2"]:
                satellite.tle_line2 = record["line2"]
                changed = True
            if changed:
                ingested_count += 1

    await db_session.commit()
    return ingested_count
