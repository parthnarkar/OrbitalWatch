from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.satellite import SatelliteModel
from app.schemas.satellite import SatelliteResponse
from app.services.propagation import propagate_satellite

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


def _determine_country(name: str) -> str:
    """Best-effort country determination from satellite name.

    Returns ISO country code or descriptive string.
    Falls back to "Unknown" rather than incorrectly defaulting to "US".
    """
    name_upper = name.upper()
    if any(k in name_upper for k in ("QIANFAN", "CZ-", "TIANGONG", "ZHUQUE", "LIJIAN",
                                      "FENGYUN", "SHIJIAN", "CHINASAT", "TIANLIAN",
                                      "BEIDOU", "QZS")):
        return "CN"
    if any(k in name_upper for k in ("COSMOS", "SL-", "RESURS", "GLONASS", "ELEKTRO",
                                      "MOLNIYA", "SPEKTR")):
        return "RU"
    if "ONEWEB" in name_upper:
        return "GB"
    if "ISS" in name_upper or "ZARYA" in name_upper or "ZVEZDA" in name_upper:
        return "US/RU/ESA/JP"
    if "INTELSAT" in name_upper:
        return "LU"
    if any(k in name_upper for k in ("STARLINK", "GPS", "NAVSTAR", "GOES",
                                      "LANDSAT", "NOAA", "TERRA", "AQUA")):
        return "US"
    if any(k in name_upper for k in ("SENTINEL", "ENVISAT", "METEOSAT", "MSG",
                                      "SPOT", "ASTRIUM", "PLEIADES")):
        return "EU"
    if any(k in name_upper for k in ("ALOS", "HIMAWARI", "DAICHI", "MICHIBIKI")):
        return "JP"
    if any(k in name_upper for k in ("CARTOSAT", "RESOURCESAT", "IRNSS", "GSAT")):
        return "IN"
    if "ARABSAT" in name_upper:
        return "SA"
    # Default to Unknown rather than incorrectly asserting US
    return "Unknown"


def _extract_launch_year(tle_line1: str | None) -> str:
    """Extract the launch year from TLE Line 1 epoch field (columns 19-20).

    Returns a YYYY-01-01 string. The TLE epoch encodes only year+day — full
    launch date is not available from TLE data alone.
    """
    try:
        if not tle_line1:
            return "Unknown"
        year_str = tle_line1[18:20].strip()
        if year_str.isdigit():
            year = int(year_str)
            full_year = 1900 + year if year >= 57 else 2000 + year
            return f"{full_year}-01-01"
    except Exception:
        pass
    return "Unknown"


async def _populate_satellite_fields(satellite: SatelliteModel) -> dict[str, object]:
    """Populate extended satellite fields including a propagated position.

    Propagation runs in a thread pool so it does not block the event loop.
    """
    pos = await asyncio.to_thread(propagate_satellite, satellite)

    # Parse inclination from TLE Line 2 (columns 8-16)
    try:
        inc = float(satellite.tle_line2[8:16].strip())
    except Exception:
        inc = 0.0

    return {
        "id": satellite.id,
        "norad_id": satellite.norad_id,
        "name": satellite.name,
        "object_type": satellite.object_type,
        "tle_line1": satellite.tle_line1,
        "tle_line2": satellite.tle_line2,
        "created_at": satellite.created_at,
        "altitude_km": pos["altitude_km"] if pos else 0.0,
        "velocity_kms": pos["velocity_kms"] if pos else 0.0,
        "orbital_period_min": pos["orbital_period_min"] if pos else 0.0,
        "inclination": inc,
        "launch_date": _extract_launch_year(satellite.tle_line1),
        "country": _determine_country(satellite.name),
    }


@router.get("", response_model=list[SatelliteResponse])
@router.get("/", response_model=list[SatelliteResponse], include_in_schema=False)
async def list_satellites(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    object_type: str | None = Query(default=None),
) -> list[dict[str, object]]:
    stmt = select(SatelliteModel).order_by(SatelliteModel.name).offset(offset).limit(limit)
    if object_type:
        stmt = stmt.where(SatelliteModel.object_type == object_type)
    result = await db.execute(stmt)
    satellites = list(result.scalars().all())
    # Run all propagations concurrently in thread pool — non-blocking
    return await asyncio.gather(*[_populate_satellite_fields(sat) for sat in satellites])


@router.get("/search", response_model=list[SatelliteResponse])
async def search_satellites(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict[str, object]]:
    query = f"%{q.strip()}%"
    stmt = (
        select(SatelliteModel)
        .where(or_(SatelliteModel.name.ilike(query), SatelliteModel.norad_id.ilike(query)))
        .order_by(SatelliteModel.name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    satellites = list(result.scalars().all())
    return await asyncio.gather(*[_populate_satellite_fields(sat) for sat in satellites])


@router.get("/{norad_id}", response_model=SatelliteResponse)
async def get_satellite(
    norad_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    result = await db.execute(select(SatelliteModel).where(SatelliteModel.norad_id == norad_id))
    satellite = result.scalar_one_or_none()
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found")
    return await _populate_satellite_fields(satellite)
