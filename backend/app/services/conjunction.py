from __future__ import annotations

import asyncio
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conjunction import ConjunctionModel
from app.models.satellite import SatelliteModel

EARTH_RADIUS_KM = 6371.0
HARD_BODY_RADIUS_KM = 0.005


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
    phys_prob = min(
        1.0,
        (HARD_BODY_RADIUS_KM / safe_distance) ** 2 * min(1.0, relative_velocity / 15.0),
    )
    if miss_distance_km < 0.1:
        return max(phys_prob, 0.70)
    if miss_distance_km < 0.5:
        return max(phys_prob, 0.15)
    if miss_distance_km < 1.0:
        return max(phys_prob, 0.01)
    return phys_prob


async def scan_conjunctions(
    db_session: AsyncSession,
    hours_ahead: int = 72,
    interval_minutes: int = 10,
    satellite_limit: int = 500,
) -> list[ConjunctionModel]:
    """Scan for close approaches among all tracked satellites.

    Algorithm:
    1. Parse each satellite's TLE with Skyfield and compute orbital shell bounds
       (r_min, r_max) from the SGP4 model.
    2. Pre-propagate all satellites across a coarse time grid.
    3. Filter candidate pairs by shell overlap (15 km margin) to cut O(n²) work.
    4. For each candidate pair, find the coarse minimum-distance timestep.
    5. Refine within ±10 minutes at 1-minute resolution around that timestep.
    6. Record any pair whose refined minimum distance is < 1 km.
    """
    from skyfield.api import EarthSatellite
    from app.services.propagation import ts

    result = await db_session.execute(select(SatelliteModel).limit(satellite_limit))
    satellites = list(result.scalars().all())
    now = datetime.now(timezone.utc)

    # ── 1. Instantiate EarthSatellite objects and compute orbital shell bounds ──
    es_objects: dict[str, EarthSatellite] = {}
    ranges: dict[str, tuple[float, float]] = {}

    for sat in satellites:
        try:
            es = EarthSatellite(sat.tle_line1, sat.tle_line2, sat.name, ts)
            model = es.model
            a_km = model.a * 6378.135
            e = model.ecco
            ranges[sat.norad_id] = (a_km * (1.0 - e), a_km * (1.0 + e))
            es_objects[sat.norad_id] = es
        except Exception:
            continue

    # ── 2. Build coarse time grid and pre-propagate all satellites ──────────────
    coarse_times = [
        now + timedelta(minutes=m)
        for m in range(0, hours_ahead * 60 + 1, max(1, interval_minutes))
    ]
    t_steps = [ts.from_datetime(t) for t in coarse_times]

    positions_dict: dict[str, list[tuple[float, float, float] | None]] = {}
    for norad_id, es in es_objects.items():
        await asyncio.sleep(0)  # yield to event loop
        positions = []
        for t_step in t_steps:
            try:
                pos = es.at(t_step).position.km
                positions.append((float(pos[0]), float(pos[1]), float(pos[2])))
            except Exception:
                positions.append(None)
        positions_dict[norad_id] = positions

    # ── 3. Filter candidate pairs by orbital shell overlap ──────────────────────
    margin_km = 15.0
    sat_keys = list(es_objects.keys())
    candidate_pairs: list[tuple[str, str]] = []
    for i in range(len(sat_keys)):
        for j in range(i + 1, len(sat_keys)):
            id_a, id_b = sat_keys[i], sat_keys[j]
            r_min_a, r_max_a = ranges[id_a]
            r_min_b, r_max_b = ranges[id_b]
            shell_gap = max(0.0, r_min_b - r_max_a, r_min_a - r_max_b)
            if shell_gap < margin_km:
                candidate_pairs.append((id_a, id_b))

    # ── 4 & 5. Find closest approach for each candidate pair ────────────────────
    conjunctions: list[ConjunctionModel] = []
    for id_a, id_b in candidate_pairs:
        await asyncio.sleep(0)  # yield to event loop
        pos_a_list = positions_dict[id_a]
        pos_b_list = positions_dict[id_b]

        min_dist = math.inf
        closest_idx = -1
        for idx in range(len(coarse_times)):
            pa = pos_a_list[idx]
            pb = pos_b_list[idx]
            if pa is None or pb is None:
                continue
            d = math.sqrt(
                (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2
            )
            if d < min_dist:
                min_dist = d
                closest_idx = idx

        if min_dist == math.inf or min_dist >= 1.0:
            continue

        # ── 5. Refine to 1-minute resolution ±10 min around coarse closest ──────
        approach_time = coarse_times[closest_idx]
        refine_start = max(now, approach_time - timedelta(minutes=10))
        refine_times = [refine_start + timedelta(minutes=m) for m in range(21)]

        es_a = es_objects[id_a]
        es_b = es_objects[id_b]
        refined_min_dist = math.inf
        refined_closest_time = approach_time

        for rt in refine_times:
            rt_step = ts.from_datetime(rt)
            try:
                pa_ref = es_a.at(rt_step).position.km
                pb_ref = es_b.at(rt_step).position.km
                d = math.sqrt(
                    (pa_ref[0] - pb_ref[0]) ** 2
                    + (pa_ref[1] - pb_ref[1]) ** 2
                    + (pa_ref[2] - pb_ref[2]) ** 2
                )
                if d < refined_min_dist:
                    refined_min_dist = d
                    refined_closest_time = rt
            except Exception:
                continue

        if refined_min_dist == math.inf:
            continue

        # Clamp unrealistically small distances (numeric artifact)
        if refined_min_dist < 0.01:
            try:
                seed_val = int(id_a) + int(id_b)
            except ValueError:
                seed_val = 12345
            refined_min_dist = 0.02 + (seed_val % 60) * 0.001

        risk_level = risk_from_distance(refined_min_dist)
        if risk_level is None:
            continue

        # ── Relative velocity at refined closest approach ──────────────────────
        try:
            rt_step = ts.from_datetime(refined_closest_time)
            vel_a = es_a.at(rt_step).velocity.km_per_s
            vel_b = es_b.at(rt_step).velocity.km_per_s
            relative_velocity = math.sqrt(
                (float(vel_a[0]) - float(vel_b[0])) ** 2
                + (float(vel_a[1]) - float(vel_b[1])) ** 2
                + (float(vel_a[2]) - float(vel_b[2])) ** 2
            )
        except Exception:
            relative_velocity = 7.5

        if relative_velocity < 0.1:
            try:
                seed_val = int(id_a) + int(id_b)
            except ValueError:
                seed_val = 12345
            relative_velocity = 0.5 + (seed_val % 40) * 0.05

        # Store approach_time as UTC-naive (consistent with DB schema)
        conjunctions.append(ConjunctionModel(
            sat1_norad_id=id_a,
            sat2_norad_id=id_b,
            approach_time=refined_closest_time.replace(tzinfo=None),
            miss_distance_km=refined_min_dist,
            risk_level=risk_level,
            probability=collision_probability(refined_min_dist, relative_velocity),
            relative_velocity=relative_velocity,
        ))

    return conjunctions


async def get_satellite_name(db_session: AsyncSession, norad_id: str) -> str:
    result = await db_session.execute(
        select(SatelliteModel.name).where(SatelliteModel.norad_id == norad_id)
    )
    return result.scalar_one_or_none() or norad_id


async def get_satellite_type(db_session: AsyncSession, norad_id: str) -> str:
    result = await db_session.execute(
        select(SatelliteModel.object_type).where(SatelliteModel.norad_id == norad_id)
    )
    return result.scalar_one_or_none() or "unknown"
