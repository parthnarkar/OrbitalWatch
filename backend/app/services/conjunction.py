from __future__ import annotations

import asyncio
import math
from datetime import datetime, timedelta, timezone
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conjunction import ConjunctionModel
from app.models.satellite import SatelliteModel
from app.services.propagation import propagate_satellite

EARTH_RADIUS_KM = 6371.0
HARD_BODY_RADIUS_KM = 0.005


def latlon_to_cartesian(latitude: float, longitude: float, altitude_km: float) -> tuple[float, float, float]:
    lat = math.radians(latitude)
    lon = math.radians(longitude)
    radius = EARTH_RADIUS_KM + altitude_km
    return (
        radius * math.cos(lat) * math.cos(lon),
        radius * math.cos(lat) * math.sin(lon),
        radius * math.sin(lat),
    )


def distance_km(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def altitude_band(altitude_km: float) -> int:
    if altitude_km < 500:
        return 0
    if altitude_km < 1000:
        return 1
    if altitude_km < 2000:
        return 2
    return 3


def risk_from_distance(miss_distance_km: float) -> str | None:
    if miss_distance_km < 0.1:
        return "HIGH"
    if miss_distance_km < 0.5:
        return "MEDIUM"
    if miss_distance_km < 1.0:
        return "LOW"
    return None


def collision_probability(miss_distance_km: float, relative_velocity: float) -> float:
    safe_distance = max(miss_distance_km, 0.001)
    return min(1.0, (HARD_BODY_RADIUS_KM / safe_distance) ** 2 * min(1.0, relative_velocity / 15.0))


async def _propagate_async(satellite: SatelliteModel, timestamp: datetime) -> tuple[SatelliteModel, dict | None]:
    return satellite, await asyncio.to_thread(propagate_satellite, satellite, timestamp)


async def _candidate_pairs(satellites: list[SatelliteModel], now: datetime) -> list[tuple[SatelliteModel, SatelliteModel]]:
    current = await asyncio.gather(*[_propagate_async(satellite, now) for satellite in satellites])
    bands: dict[int, list[SatelliteModel]] = {0: [], 1: [], 2: [], 3: []}
    for satellite, position in current:
        if position is not None:
            bands[altitude_band(float(position["altitude_km"]))].append(satellite)

    pairs: list[tuple[SatelliteModel, SatelliteModel]] = []
    seen: set[tuple[str, str]] = set()
    for band, members in bands.items():
        candidates = members + bands.get(band + 1, [])
        for sat_a, sat_b in combinations(candidates, 2):
            key = tuple(sorted((sat_a.norad_id, sat_b.norad_id)))
            if key not in seen:
                seen.add(key)
                pairs.append((sat_a, sat_b))
    return pairs


async def _scan_pair(
    sat_a: SatelliteModel,
    sat_b: SatelliteModel,
    timestamps: list[datetime],
) -> tuple[float, datetime, float] | None:
    min_distance = math.inf
    closest_time = timestamps[0]
    closest_velocity_delta = 0.0

    for timestamp in timestamps:
        pos_a, pos_b = await asyncio.gather(
            asyncio.to_thread(propagate_satellite, sat_a, timestamp),
            asyncio.to_thread(propagate_satellite, sat_b, timestamp),
        )
        if pos_a is None or pos_b is None:
            continue

        point_a = latlon_to_cartesian(pos_a["latitude"], pos_a["longitude"], pos_a["altitude_km"])
        point_b = latlon_to_cartesian(pos_b["latitude"], pos_b["longitude"], pos_b["altitude_km"])
        miss_distance = distance_km(point_a, point_b)
        if miss_distance < min_distance:
            min_distance = miss_distance
            closest_time = timestamp
            closest_velocity_delta = abs(float(pos_a["velocity_kms"]) - float(pos_b["velocity_kms"]))

    if min_distance == math.inf:
        return None
    return min_distance, closest_time, closest_velocity_delta


async def _build_conjunction(
    sat_a: SatelliteModel,
    sat_b: SatelliteModel,
    now: datetime,
    coarse_times: list[datetime],
) -> ConjunctionModel | None:
    scan = await _scan_pair(sat_a, sat_b, coarse_times)
    if scan is None:
        return None
    miss_distance, approach_time, relative_velocity = scan
    if miss_distance < 1.0:
        refine_start = max(now, approach_time - timedelta(minutes=10))
        refine_times = [refine_start + timedelta(minutes=minute) for minute in range(0, 21)]
        refined = await _scan_pair(sat_a, sat_b, refine_times)
        if refined is not None:
            miss_distance, approach_time, relative_velocity = refined

    risk_level = risk_from_distance(miss_distance)
    if risk_level is None:
        return None
    return ConjunctionModel(
        sat1_norad_id=sat_a.norad_id,
        sat2_norad_id=sat_b.norad_id,
        approach_time=approach_time.replace(tzinfo=None),
        miss_distance_km=miss_distance,
        risk_level=risk_level,
        probability=collision_probability(miss_distance, relative_velocity),
    )


async def scan_conjunctions(
    db_session: AsyncSession,
    hours_ahead: int = 72,
    interval_minutes: int = 10,
    satellite_limit: int = 500,
) -> list[ConjunctionModel]:
    result = await db_session.execute(select(SatelliteModel).limit(satellite_limit))
    satellites = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    pairs = await _candidate_pairs(satellites, now)
    coarse_times = [
        now + timedelta(minutes=minutes)
        for minutes in range(0, hours_ahead * 60 + 1, max(1, interval_minutes))
    ]

    conjunctions: list[ConjunctionModel] = []
    batch_size = 50
    for start in range(0, len(pairs), batch_size):
        batch = pairs[start : start + batch_size]
        results = await asyncio.gather(
            *[_build_conjunction(sat_a, sat_b, now, coarse_times) for sat_a, sat_b in batch]
        )
        conjunctions.extend(result for result in results if result is not None)
    return conjunctions


async def get_satellite_name(db_session: AsyncSession, norad_id: str) -> str:
    result = await db_session.execute(select(SatelliteModel.name).where(SatelliteModel.norad_id == norad_id))
    return result.scalar_one_or_none() or norad_id
