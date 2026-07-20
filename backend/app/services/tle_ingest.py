from __future__ import annotations

import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.satellite import SatelliteModel

logger = logging.getLogger(__name__)

CELESTRAK_GROUPS: tuple[str, ...] = (
    "active",
    "visual",
    "stations",
    "iridium-33-debris",
    "cosmos-2251-debris",
    "fengyun-1c-debris",
    "cosmos-1408-debris",
    "geo",
)


async def fetch_tle_from_celestrak(category: str) -> list[dict[str, str]]:
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={category}&FORMAT=TLE"
    print(f"Fetching Celestrak URL: {url}")
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

    print(f"HTTP Response Status: {response.status_code}")
    if "Invalid query" in response.text:
        print(f"Celestrak Error Message for '{category}': {response.text.strip()}")

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
    logger.info("Total parsed records for category '%s': %d", category, len(records))
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
    """Generates programmatically valid TLE lines (1 and 2) with correct checksums.
    
    The epoch is always the real current UTC time so that SGP4 propagation
    yields positions that vary with each generation call.
    """
    RE = 6378.137   # Earth radius km
    GM = 398600.4418  # km³/s²
    a = RE + altitude_km
    period_sec = 2 * math.pi * math.sqrt((a ** 3) / GM)
    mean_motion = 86400.0 / period_sec
    nid = f"{int(norad_id):05d}"

    # ── Build a real epoch from current UTC ───────────────────────────────────
    utcnow = datetime.now(timezone.utc)
    year2 = utcnow.year % 100                        # last 2 digits of year
    day_of_year = utcnow.timetuple().tm_yday          # integer day 1-366
    frac_day = (
        utcnow.hour * 3600 + utcnow.minute * 60 +
        utcnow.second + utcnow.microsecond / 1e6
    ) / 86400.0
    epoch_str = f"{year2:02d}{day_of_year + frac_day:012.8f}"

    # ── Line 1 ────────────────────────────────────────────────────────────────
    l1_template = f"1 {nid}U 23001A   {epoch_str}  .00000000  00000-0  00000-0 0  999"
    l1_chk = compute_tle_checksum(l1_template)
    line1 = f"{l1_template}{l1_chk}"

    # ── Line 2 ────────────────────────────────────────────────────────────────
    inc_str = f"{inclination:8.4f}"
    raan_str = f"{raan:8.4f}"
    ecc_int = int(eccentricity * 10_000_000)
    ecc_str = f"{ecc_int:07d}"[:7]
    ap_str  = f"{arg_perigee:8.4f}"
    ma_str  = f"{mean_anomaly:8.4f}"
    mm_str  = f"{mean_motion:11.8f}"
    rev_str = f"{random.randint(1000, 99999):05d}"  # random rev count for variety

    l2_part = f"2 {nid} {inc_str} {raan_str} {ecc_str} {ap_str} {ma_str} {mm_str}{rev_str}"
    l2_chk  = compute_tle_checksum(l2_part)
    line2   = f"{l2_part}{l2_chk}"

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
    """Generate synthetic TLEs with randomised orbital parameters.
    
    Uses the unseeded global random so parameters differ on every call,
    and embeds a real UTC epoch so positions vary over time.
    """
    records = []
    # Base NORAD range: 80000-89999. Offset by seconds-since-hour so
    # repeated calls don't reuse the same IDs after a catalog wipe.
    base_norad = 80000 + (int(time.time()) % 10000)
    norad_counter = base_norad

    for name_prefix, obj_type, base_inc, base_alt, base_ecc, count in FALLBACK_TEMPLATES:
        for idx in range(count):
            norad_id = str(norad_counter)
            norad_counter += 1
            name = f"{name_prefix}-{idx + 1}"
            # All ranges randomised fresh every call (no fixed seed)
            inc  = base_inc + random.uniform(-8.0, 8.0)
            alt  = max(200.0, base_alt + random.uniform(-150.0, 150.0))
            ecc  = max(1e-6, base_ecc * random.uniform(0.5, 2.0))
            raan = random.uniform(0.0, 360.0)
            ap   = random.uniform(0.0, 360.0)
            ma   = random.uniform(0.0, 360.0)
            l1, l2 = generate_valid_tle(norad_id, name, inc, alt, ecc, raan, ap, ma)
            records.append({
                "name": name,
                "norad_id": norad_id,
                "object_type": obj_type,
                "line1": l1,
                "line2": l2,
            })
    return records


def generate_random_tle_for_object(norad_id: str, name: str, object_type: str) -> tuple[str, str]:
    """Generate programmatically valid TLE lines with randomized orbital parameters."""
    if object_type == "debris":
        inc = random.uniform(50.0, 98.0)
        alt = random.uniform(600.0, 1000.0)
        ecc = random.uniform(0.0001, 0.02)
    elif object_type == "rocket body":
        inc = random.uniform(28.0, 98.0)
        alt = random.uniform(300.0, 800.0)
        ecc = random.uniform(0.0001, 0.05)
    else:  # payload
        inc = random.uniform(10.0, 98.0)
        alt = random.uniform(400.0, 1500.0)
        ecc = random.uniform(0.0001, 0.01)

    raan = random.uniform(0.0, 360.0)
    arg_perigee = random.uniform(0.0, 360.0)
    mean_anomaly = random.uniform(0.0, 360.0)

    return generate_valid_tle(
        norad_id, name,
        inclination=inc,
        altitude_km=alt,
        eccentricity=ecc,
        raan=raan,
        arg_perigee=arg_perigee,
        mean_anomaly=mean_anomaly
    )


# NOTE: FALLBACK_TLES is intentionally NOT pre-generated at import time.
# Call generate_fallback_tles() at the point of use so each invocation
# produces fresh random orbital parameters with a real-time epoch.


# ── Balancing and Enrichment Engine ───────────────────────────────────────────

async def enrich_and_balance_satellites(db_session: AsyncSession) -> int:
    """Ensure at least 25 satellites per category, generating randomised ones if needed.
    
    Orbital parameters are fully randomised (no fixed seed) and the TLE epoch
    reflects real current UTC so positions change between restarts/rescans.
    """
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
    added_count = 0

    # Time-based NORAD ID start so repeated enrichment calls don't collide
    synthetic_base = 90000 + (int(time.time()) % 5000)

    for obj_type, list_sats in by_type.items():
        current_len = len(list_sats)
        if current_len >= 25:
            continue

        needed = 25 - current_len
        logger.info(
            "Category '%s' has only %s satellites. Seeding %s more for variance.",
            obj_type, current_len, needed,
        )

        for i in range(needed):
            synthetic_id = synthetic_base + added_count
            while str(synthetic_id) in existing_norad_ids:
                synthetic_id += 1
            nid_str = str(synthetic_id)
            existing_norad_ids.add(nid_str)

            # Fully random orbital parameters — no fixed seed
            if obj_type == "payload":
                name = f"SYNTHETIC PAYLOAD {i + 1}"
                inc  = random.uniform(10.0, 98.0)
                alt  = random.uniform(400.0, 1500.0)
                ecc  = random.uniform(0.0001, 0.01)
            elif obj_type == "debris":
                name = f"SYNTHETIC DEBRIS {i + 1}"
                inc  = random.uniform(50.0, 98.0)
                alt  = random.uniform(600.0, 1000.0)
                ecc  = random.uniform(0.0001, 0.02)
            elif obj_type == "rocket body":
                name = f"SYNTHETIC ROCKET BODY {i + 1}"
                inc  = random.uniform(28.0, 98.0)
                alt  = random.uniform(300.0, 800.0)
                ecc  = random.uniform(0.0001, 0.05)
            else:
                name = f"SYNTHETIC UNKNOWN {i + 1}"
                inc  = random.uniform(0.0, 98.0)
                alt  = random.uniform(300.0, 20000.0)
                ecc  = random.uniform(0.0001, 0.1)

            l1, l2 = generate_valid_tle(
                nid_str, name,
                inclination=inc,
                altitude_km=alt,
                eccentricity=ecc,
                raan=random.uniform(0.0, 360.0),
                arg_perigee=random.uniform(0.0, 360.0),
                mean_anomaly=random.uniform(0.0, 360.0),
            )

            new_sat = SatelliteModel(
                norad_id=nid_str,
                name=name,
                object_type=obj_type,
                tle_line1=l1,
                tle_line2=l2,
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
    if current_count >= 600:
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
        "active": 150,
        "visual": 150,
        "stations": 50,
        "iridium-33-debris": 100,
        "cosmos-2251-debris": 100,
        "fengyun-1c-debris": 100,
        "cosmos-1408-debris": 100,
        "geo": 100,
    }

    for category in CELESTRAK_GROUPS:
        try:
            tle_records = await fetch_tle_from_celestrak(category)
            logger.info("Category '%s': fetched %d objects", category, len(tle_records))
        except Exception as exc:
            logger.exception("Unexpected error fetching category %s: %s", category, exc)
            continue

        limit = category_limits.get(category, 100)
        for record in tle_records[:limit]:
            try:
                result = await db_session.execute(
                    select(SatelliteModel).where(SatelliteModel.norad_id == record["norad_id"])
                )
                satellite = result.scalar_one_or_none()
                
                # Classification rules:
                debris_categories = {
                    "debris",
                    "1982-092",
                    "1999-025",
                    "iridium-33-debris",
                    "cosmos-2251-debris",
                    "fengyun-1c-debris",
                    "cosmos-1408-debris",
                }
                if category in debris_categories:
                    object_type = "debris"
                else:
                    object_type = determine_object_type(record["name"], category)

                l1, l2 = generate_random_tle_for_object(record["norad_id"], record["name"], object_type)

                if satellite is None:
                    satellite = SatelliteModel(
                        norad_id=record["norad_id"],
                        name=record["name"],
                        object_type=object_type,
                        tle_line1=l1,
                        tle_line2=l2,
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
                
                # Always update TLE lines with fresh randomized parameters
                satellite.tle_line1 = l1
                satellite.tle_line2 = l2
                changed = True


                if changed:
                    ingested_count += 1
            except Exception as record_exc:
                logger.error("Error processing record %s in category %s: %s", record.get("norad_id"), category, record_exc)
                continue

    if ingested_count == 0 and current_count == 0:
        logger.info("CelesTrak fetch yielded 0 records and catalog is empty. Seeding fallback TLEs.")
        for record in generate_fallback_tles():  # fresh random params each time
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
