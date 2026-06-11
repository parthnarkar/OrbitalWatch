from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.satellite import SatelliteModel

logger = logging.getLogger(__name__)

CELESTRAK_GROUPS: tuple[str, ...] = ("last-30-days", "visual", "stations", "science", "debris")


async def fetch_tle_from_celestrak(category: str) -> list[dict[str, str]]:
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={category}&FORMAT=TLE"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Failed to fetch TLEs for category %s: %s (continuing with other categories)", category, exc)
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


FALLBACK_TLES: list[dict[str, str]] = [
    {
        "name": "ISS (ZARYA)",
        "norad_id": "25544",
        "object_type": "payload",
        "line1": "1 25544U 98067A   26162.53403935  .00014605  00000-0  26857-3 0  9997",
        "line2": "2 25544  51.6416 350.2223 0005272  87.2341  14.5028 15.49856230571991"
    },
    {
        "name": "HST",
        "norad_id": "20580",
        "object_type": "payload",
        "line1": "1 20580U 90037B   26162.24792824  .00001046  00000-0  48255-4 0  9993",
        "line2": "2 20580  28.4682  74.3218 0002842 278.4312  81.5623 15.00281358983210"
    },
    {
        "name": "NOAA 19",
        "norad_id": "33591",
        "object_type": "payload",
        "line1": "1 33591U 09005A   26162.51829038  .00000124  00000-0  74328-4 0  9995",
        "line2": "2 33591  99.1245 230.1245 0013824 120.3812 240.1293 14.12039128892301"
    },
    {
        "name": "TIANGONG",
        "norad_id": "48274",
        "object_type": "payload",
        "line1": "1 48274U 21035A   26162.54829381  .00011293  00000-0  21029-3 0  9992",
        "line2": "2 48274  41.5823 110.1283 0003824 140.2812 220.3812 15.62039482273941"
    },
    {
        "name": "CZ-4B DEBRIS",
        "norad_id": "27386",
        "object_type": "debris",
        "line1": "1 27386U 99057B   26162.48203918  .00000382  00000-0  10283-3 0  9998",
        "line2": "2 27386  98.2384 140.3812 0001893  90.2381 270.1203 14.38201938201931"
    }
]


async def ingest_satellites(db_session: AsyncSession) -> int:
    # Check current count
    count_result = await db_session.execute(select(SatelliteModel))
    current_count = len(list(count_result.scalars().all()))

    if current_count >= 300:
        logger.info("Catalog already seeded with %s satellites", current_count)
        return 0

    ingested_count = 0
    category_limits = {
        "last-30-days": 150,
        "visual": 150,
        "stations": 50,
        "science": 150,
        "debris": 150
    }

    for category in CELESTRAK_GROUPS:
        try:
            tle_records = await fetch_tle_from_celestrak(category)
        except Exception:  # pragma: no cover - network safety net
            logger.exception("Unexpected error fetching category %s", category)
            continue

        object_type = "debris" if category == "debris" else "payload"
        limit = category_limits.get(category, 100)
        for record in tle_records[:limit]:
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

    if ingested_count == 0 and current_count == 0:
        logger.info("CelesTrak fetch yielded 0 records and catalog is empty. Seeding fallback TLEs.")
        for record in FALLBACK_TLES:
            satellite = SatelliteModel(
                norad_id=record["norad_id"],
                name=record["name"],
                object_type=record["object_type"],
                tle_line1=record["line1"],
                tle_line2=record["line2"],
            )
            db_session.add(satellite)
            ingested_count += 1

    await db_session.commit()
    return ingested_count

