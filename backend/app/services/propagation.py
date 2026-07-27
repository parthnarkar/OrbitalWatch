from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import TypedDict

from skyfield.api import EarthSatellite, load

from app.models.satellite import SatelliteModel

logger = logging.getLogger(__name__)
ts = load.timescale()


class PropagationResult(TypedDict):
    latitude: float
    longitude: float
    altitude_km: float
    velocity_kms: float
    orbital_period_min: float
    timestamp: datetime
    geocentric_km: tuple[float, float, float]
    velocity_vector_kms: tuple[float, float, float]


def ensure_utc(timestamp: datetime | None = None) -> datetime:
    if timestamp is None:
        return datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


# In-memory cache to store instantiated EarthSatellite objects to prevent parsing TLE strings repeatedly.
# Maps: norad_id -> (tle_line1, tle_line2, EarthSatellite)
_satellite_cache: dict[str, tuple[str, str, EarthSatellite]] = {}


def propagate_satellite(
    satellite: SatelliteModel,
    timestamp: datetime | None = None,
) -> PropagationResult | None:
    moment = ensure_utc(timestamp)
    try:
        cached = _satellite_cache.get(satellite.norad_id)
        if cached and cached[0] == satellite.tle_line1 and cached[1] == satellite.tle_line2:
            earth_satellite = cached[2]
        else:
            earth_satellite = EarthSatellite(
                satellite.tle_line1,
                satellite.tle_line2,
                satellite.name,
                ts,
            )
            _satellite_cache[satellite.norad_id] = (
                satellite.tle_line1,
                satellite.tle_line2,
                earth_satellite,
            )
        t = ts.from_datetime(moment)
        geocentric = earth_satellite.at(t)
        subpoint = geocentric.subpoint()
        velocity = geocentric.velocity.km_per_s
        position = geocentric.position.km

        if (
            math.isnan(position[0])
            or math.isnan(position[1])
            or math.isnan(position[2])
            or math.isnan(velocity[0])
            or math.isnan(velocity[1])
            or math.isnan(velocity[2])
        ):
            return None

        speed = math.sqrt(float(velocity[0]) ** 2 + float(velocity[1]) ** 2 + float(velocity[2]) ** 2)
        no_kozai = float(earth_satellite.model.no_kozai)
        orbital_period = (2 * math.pi / no_kozai) if no_kozai else 0.0

        return {
            "latitude": float(subpoint.latitude.degrees),
            "longitude": float(subpoint.longitude.degrees),
            "altitude_km": float(subpoint.elevation.km),
            "velocity_kms": speed,
            "orbital_period_min": orbital_period,
            "timestamp": moment,
            "geocentric_km": (float(position[0]), float(position[1]), float(position[2])),
            "velocity_vector_kms": (float(velocity[0]), float(velocity[1]), float(velocity[2])),
        }
    except Exception:
        logger.exception("Failed to propagate satellite %s", satellite.norad_id)
        return None

