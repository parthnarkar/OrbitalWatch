from __future__ import annotations

import logging
import math
import random
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.satellite import SatelliteModel

logger = logging.getLogger(__name__)

CELESTRAK_GROUPS: tuple[str, ...] = (
    "last-30-days",
    "visual",
    "stations",
    "science",
    "iridium-33-debris",
    "cosmos-2251-debris",
)


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


# ── Determine Object Type Helper ──────────────────────────────────────────────

def determine_object_type(name: str, category: str) -> str:
    name_upper = name.upper()
    cat_lower = category.lower()
    if "R/B" in name_upper or "ROCKET BODY" in name_upper or "BOOSTER" in name_upper:
        return "rocket body"
    elif "DEB" in name_upper or "DEBRIS" in name_upper or "FRAG" in name_upper or "debris" in cat_lower:
        return "debris"
    elif "UNKNOWN" in name_upper or "UNIDENTIFIED" in name_upper:
        return "unknown"
    else:
        return "payload"


# ── TLE Calculations and Verification Helpers ─────────────────────────────────

def compute_tle_checksum(line: str) -> int:
    """Computes the modulo 10 checksum for a TLE line string."""
    total = 0
    for char in line[:68]:
        if char.isdigit():
            total += int(char)
        elif char == "-":
            total += 1
    return total % 10


def generate_valid_tle(
    norad_id: str,
    name: str,
    inclination: float,
    altitude_km: float,
    eccentricity: float = 0.0001,
    raan: float = 0.0,
    arg_perigee: float = 0.0,
    mean_anomaly: float = 0.0,
) -> tuple[str, str]:
    """Generates programmatically valid TLE lines (1 and 2) with correct checksums."""
    RE = 6378.137  # Earth radius in km
    GM = 398600.4418  # GM in km^3/s^2
    a = RE + altitude_km
    period_sec = 2 * math.pi * math.sqrt((a ** 3) / GM)
    mean_motion = 86400.0 / period_sec
    nid = f"{int(norad_id):05d}"

    # Line 1 Template
    l1_template = f"1 {nid}U 23001A   26162.50000000  .00000000  00000-0  00000-0 0  999"
    l1_chk = compute_tle_checksum(l1_template)
    line1 = f"{l1_template}{l1_chk}"

    # Line 2 Elements Formatting
    inc_str = f"{inclination:8.4f}"
    raan_str = f"{raan:8.4f}"
    ecc_int = int(eccentricity * 10000000)
    ecc_str = f"{ecc_int:07d}"[:7]
    ap_str = f"{arg_perigee:8.4f}"
    ma_str = f"{mean_anomaly:8.4f}"
    mm_str = f"{mean_motion:11.8f}"
    rev_str = "01234"

    # Line 2 Assembly
    l2_part = f"2 {nid} {inc_str} {raan_str} {ecc_str} {ap_str} {ma_str} {mm_str}{rev_str}"
    l2_chk = compute_tle_checksum(l2_part)
    line2 = f"{l2_part}{l2_chk}"

    return line1, line2


# ── High-Variance Fallback Templates ──────────────────────────────────────────

FALLBACK_TEMPLATES = [
    # (name_prefix, object_type, base_inclination, base_altitude, base_eccentricity, count)
    ("STARLINK", "payload", 53.0, 550, 0.0001, 15),
    ("ONEWEB", "payload", 87.9, 1200, 0.0002, 10),
    ("GPS", "payload", 55.0, 20200, 0.005, 5),
    ("INTELSAT", "payload", 0.05, 35786, 0.0001, 5),
    ("FALCON 9 R/B", "rocket body", 53.0, 400, 0.001, 8),
    ("DELTA 4 R/B", "rocket body", 28.5, 600, 0.002, 8),
    ("CZ-3B R/B", "rocket body", 28.5, 35000, 0.7, 4),
    ("IRIDIUM 33 DEB", "debris", 86.4, 780, 0.001, 15),
    ("COSMOS 2251 DEB", "debris", 74.0, 780, 0.001, 15),
    ("UNKNOWN OBJECT", "unknown", 98.2, 500, 0.0001, 8),
    ("UNIDENTIFIED", "unknown", 51.6, 450, 0.0001, 7),
]


def generate_fallback_tles() -> list[dict[str, str]]:
    records = []
    norad_counter = 80001
    rng = random.Random(42)
    for name_prefix, obj_type, base_inc, base_alt, base_ecc, count in FALLBACK_TEMPLATES:
        for idx in range(count):
            norad_id = str(norad_counter)
            norad_counter += 1
            name = f"{name_prefix}-{idx + 1}"
            inc = base_inc + rng.uniform(-5.0, 5.0)
            alt = base_alt + rng.uniform(-100.0, 100.0)
            if alt < 200:
                alt = 200
            ecc = base_ecc * rng.uniform(0.5, 1.5)
            raan = rng.uniform(0.0, 360.0)
            ap = rng.uniform(0.0, 360.0)
            ma = rng.uniform(0.0, 360.0)
            l1, l2 = generate_valid_tle(norad_id, name, inc, alt, ecc, raan, ap, ma)
            records.append({
                "name": name,
                "norad_id": norad_id,
                "object_type": obj_type,
                "line1": l1,
                "line2": l2,
            })
    return records


FALLBACK_TLES = generate_fallback_tles()


# ── Balancing and Enrichment Engine ───────────────────────────────────────────

async def enrich_and_balance_satellites(db_session: AsyncSession) -> int:
    """Ensures there are at least 25 satellites of each category in the catalog, generating varied ones if needed."""
    result = await db_session.execute(select(SatelliteModel))
    satellites = list(result.scalars().all())

    by_type: dict[str, list[SatelliteModel]] = {"payload": [], "debris": [], "rocket body": [], "unknown": []}
    for sat in satellites:
        t = sat.object_type or "unknown"
        if t in by_type:
            by_type[t].append(sat)
        else:
            by_type["unknown"].append(sat)

    existing_norad_ids = {sat.norad_id for sat in satellites}
    rng = random.Random(1337)
    added_count = 0

    for obj_type, list_sats in by_type.items():
        current_len = len(list_sats)
        if current_len >= 25:
            continue

        needed = 25 - current_len
        logger.info("Category '%s' has only %s satellites. Seeding %s more for variance.", obj_type, current_len, needed)

        for i in range(needed):
            synthetic_id = 90000 + added_count + len(existing_norad_ids)
            while str(synthetic_id) in existing_norad_ids:
                synthetic_id += 1
            nid_str = str(synthetic_id)
            existing_norad_ids.add(nid_str)

            if obj_type == "payload":
                name = f"SYNTHETIC PAYLOAD {i+1}"
                inc = rng.uniform(10.0, 98.0)
                alt = rng.uniform(400.0, 1500.0)
                ecc = rng.uniform(0.0001, 0.01)
            elif obj_type == "debris":
                name = f"SYNTHETIC DEBRIS {i+1}"
                inc = rng.uniform(50.0, 98.0)
                alt = rng.uniform(600.0, 1000.0)
                ecc = rng.uniform(0.0001, 0.02)
            elif obj_type == "rocket body":
                name = f"SYNTHETIC ROCKET BODY {i+1}"
                inc = rng.uniform(28.0, 98.0)
                alt = rng.uniform(300.0, 800.0)
                ecc = rng.uniform(0.0001, 0.05)
            else:
                name = f"SYNTHETIC UNKNOWN {i+1}"
                inc = rng.uniform(0.0, 98.0)
                alt = rng.uniform(300.0, 20000.0)
                ecc = rng.uniform(0.0001, 0.1)

            l1, l2 = generate_valid_tle(
                nid_str,
                name,
                inclination=inc,
                altitude_km=alt,
                eccentricity=ecc,
                raan=rng.uniform(0.0, 360.0),
                arg_perigee=rng.uniform(0.0, 360.0),
                mean_anomaly=rng.uniform(0.0, 360.0)
            )

            new_sat = SatelliteModel(
                norad_id=nid_str,
                name=name,
                object_type=obj_type,
                tle_line1=l1,
                tle_line2=l2
            )
            db_session.add(new_sat)
            added_count += 1

    if added_count > 0:
        await db_session.commit()
        logger.info("Successfully added %s synthetic satellites for balancing.", added_count)

    return added_count


# ── Ingest Satellites Entrypoint ──────────────────────────────────────────────

async def ingest_satellites(db_session: AsyncSession) -> int:
    count_result = await db_session.execute(select(SatelliteModel))
    satellites = list(count_result.scalars().all())
    current_count = len(satellites)

    # Re-classify all existing satellites if already seeded
    if current_count >= 300:
        logger.info("Catalog already seeded with %s satellites. Re-classifying object types for variance.", current_count)
        updated_count = 0
        for satellite in satellites:
            new_type = determine_object_type(satellite.name, "debris" if satellite.object_type == "debris" else "")
            if satellite.object_type != new_type:
                satellite.object_type = new_type
                updated_count += 1
        if updated_count > 0:
            await db_session.commit()
            logger.info("Successfully updated %s existing satellites with correct classification.", updated_count)

        enriched_count = await enrich_and_balance_satellites(db_session)
        return enriched_count

    ingested_count = 0
    category_limits = {
        "last-30-days": 150,
        "visual": 150,
        "stations": 50,
        "science": 150,
        "iridium-33-debris": 75,
        "cosmos-2251-debris": 75,
    }

    for category in CELESTRAK_GROUPS:
        try:
            tle_records = await fetch_tle_from_celestrak(category)
        except Exception:  # pragma: no cover
            logger.exception("Unexpected error fetching category %s", category)
            continue

        limit = category_limits.get(category, 100)
        for record in tle_records[:limit]:
            result = await db_session.execute(
                select(SatelliteModel).where(SatelliteModel.norad_id == record["norad_id"])
            )
            satellite = result.scalar_one_or_none()
            object_type = determine_object_type(record["name"], category)
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

    enriched_count = await enrich_and_balance_satellites(db_session)
    return ingested_count + enriched_count
