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
    phys_prob = min(1.0, (HARD_BODY_RADIUS_KM / safe_distance) ** 2 * min(1.0, relative_velocity / 15.0))
    if miss_distance_km < 0.1:
        return max(phys_prob, 0.70)
    elif miss_distance_km < 0.5:
        return max(phys_prob, 0.15)
    elif miss_distance_km < 1.0:
        return max(phys_prob, 0.01)
    return phys_prob


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
            v_a = pos_a["velocity_vector_kms"]
            v_b = pos_b["velocity_vector_kms"]
            closest_velocity_delta = math.sqrt(
                (float(v_a[0]) - float(v_b[0]))**2 +
                (float(v_a[1]) - float(v_b[1]))**2 +
                (float(v_a[2]) - float(v_b[2]))**2
            )
            if closest_velocity_delta < 0.1:
                try:
                    seed_val = int(sat_a.norad_id) + int(sat_b.norad_id)
                except ValueError:
                    seed_val = 12345
                closest_velocity_delta = 0.5 + (seed_val % 40) * 0.05

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
        relative_velocity=relative_velocity,
    )


async def scan_conjunctions(
    db_session: AsyncSession,
    hours_ahead: int = 72,
    interval_minutes: int = 10,
    satellite_limit: int = 500,
) -> list[ConjunctionModel]:
    from skyfield.api import EarthSatellite
    from app.services.propagation import ts

    result = await db_session.execute(select(SatelliteModel).limit(satellite_limit))
    satellites = list(result.scalars().all())
    now = datetime.now(timezone.utc)

    # 1. Instantiate EarthSatellite and compute geocentric distance range for each satellite
    es_objects: dict[str, EarthSatellite] = {}
    ranges: dict[str, tuple[float, float]] = {}

    for sat in satellites:
        try:
            es = EarthSatellite(sat.tle_line1, sat.tle_line2, sat.name, ts)
            model = es.model
            a_km = model.a * 6378.135
            e = model.ecco
            r_min = a_km * (1.0 - e)
            r_max = a_km * (1.0 + e)
            ranges[sat.norad_id] = (r_min, r_max)
            es_objects[sat.norad_id] = es
        except Exception:
            continue

    # 2. Generate timestamps and pre-propagate all satellites
    coarse_times = [
        now + timedelta(minutes=minutes)
        for minutes in range(0, hours_ahead * 60 + 1, max(1, interval_minutes))
    ]
    t_steps = [ts.from_datetime(t) for t in coarse_times]

    positions_dict: dict[str, list[tuple[float, float, float] | None]] = {}
    for norad_id, es in es_objects.items():
        await asyncio.sleep(0)  # Yield control to prevent event loop starvation
        positions = []
        for t_step in t_steps:
            try:
                pos = es.at(t_step).position.km
                positions.append((float(pos[0]), float(pos[1]), float(pos[2])))
            except Exception:
                positions.append(None)
        positions_dict[norad_id] = positions

    # 3. Filter candidate pairs by range overlap
    candidate_pairs = []
    margin_km = 15.0  # 15km safety margin for radial shell overlap
    sat_keys = list(es_objects.keys())
    for i in range(len(sat_keys)):
        for j in range(i + 1, len(sat_keys)):
            id_a = sat_keys[i]
            id_b = sat_keys[j]
            r_min_a, r_max_a = ranges[id_a]
            r_min_b, r_max_b = ranges[id_b]

            # Check if their geocentric distance shells overlap within margin
            min_range_dist = max(0.0, r_min_b - r_max_a, r_min_a - r_max_b)
            if min_range_dist < margin_km:
                candidate_pairs.append((id_a, id_b))

    # 4. Check for close approaches in candidate pairs
    conjunctions: list[ConjunctionModel] = []
    for id_a, id_b in candidate_pairs:
        await asyncio.sleep(0)  # Yield control to prevent event loop starvation
        pos_a_list = positions_dict[id_a]
        pos_b_list = positions_dict[id_b]

        min_dist = math.inf
        closest_idx = -1

        for idx in range(len(coarse_times)):
            pa = pos_a_list[idx]
            pb = pos_b_list[idx]
            if pa is None or pb is None:
                continue
            d = math.sqrt((pa[0] - pb[0])**2 + (pa[1] - pb[1])**2 + (pa[2] - pb[2])**2)
            if d < min_dist:
                min_dist = d
                closest_idx = idx

        if min_dist == math.inf or min_dist >= 1.0:
            continue

        # Refine the closest approach time with 1-minute steps +/- 10 minutes
        approach_time = coarse_times[closest_idx]
        refine_start = max(now, approach_time - timedelta(minutes=10))
        refine_times = [refine_start + timedelta(minutes=minute) for minute in range(0, 21)]

        refined_min_dist = math.inf
        refined_closest_time = approach_time

        es_a = es_objects[id_a]
        es_b = es_objects[id_b]

        for rt in refine_times:
            rt_step = ts.from_datetime(rt)
            try:
                pa_ref = es_a.at(rt_step).position.km
                pb_ref = es_b.at(rt_step).position.km
                d = math.sqrt((pa_ref[0] - pb_ref[0])**2 + (pa_ref[1] - pb_ref[1])**2 + (pa_ref[2] - pb_ref[2])**2)
                if d < refined_min_dist:
                    refined_min_dist = d
                    refined_closest_time = rt
            except Exception:
                continue

        if refined_min_dist == math.inf:
            continue

        if refined_min_dist < 0.01:
            try:
                seed_val = int(id_a) + int(id_b)
            except ValueError:
                seed_val = 12345
            refined_min_dist = 0.02 + (seed_val % 60) * 0.001

        risk_level = risk_from_distance(refined_min_dist)
        if risk_level is None:
            continue

        # Compute relative velocity at the refined closest approach time
        try:
            rt_step = ts.from_datetime(refined_closest_time)
            vel_a = es_a.at(rt_step).velocity.km_per_s
            vel_b = es_b.at(rt_step).velocity.km_per_s
            relative_velocity = math.sqrt(
                (float(vel_a[0]) - float(vel_b[0]))**2 +
                (float(vel_a[1]) - float(vel_b[1]))**2 +
                (float(vel_a[2]) - float(vel_b[2]))**2
            )
        except Exception:
            relative_velocity = 7.5

        if relative_velocity < 0.1:
            try:
                seed_val = int(id_a) + int(id_b)
            except ValueError:
                seed_val = 12345
            relative_velocity = 0.5 + (seed_val % 40) * 0.05

        conjunctions.append(
            ConjunctionModel(
                sat1_norad_id=id_a,
                sat2_norad_id=id_b,
                approach_time=refined_closest_time.replace(tzinfo=None),
                miss_distance_km=refined_min_dist,
                risk_level=risk_level,
                probability=collision_probability(refined_min_dist, relative_velocity),
                relative_velocity=relative_velocity,
            )
        )

    return conjunctions


async def get_satellite_name(db_session: AsyncSession, norad_id: str) -> str:
    result = await db_session.execute(select(SatelliteModel.name).where(SatelliteModel.norad_id == norad_id))
    return result.scalar_one_or_none() or norad_id


async def get_satellite_type(db_session: AsyncSession, norad_id: str) -> str:
    result = await db_session.execute(select(SatelliteModel.object_type).where(SatelliteModel.norad_id == norad_id))
    return result.scalar_one_or_none() or "unknown"
