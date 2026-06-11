from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.satellite import SatelliteModel
from app.schemas.satellite import SatelliteResponse
from app.services.propagation import propagate_satellite

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


def populate_satellite_extra_fields(satellite: SatelliteModel) -> dict[str, object]:
    pos = propagate_satellite(satellite)
    
    # 1. Parse inclination from TLE Line 2
    try:
        inc = float(satellite.tle_line2[8:16].strip())
    except Exception:
        inc = 0.0
        
    # 2. Extract launch year and day from TLE Line 1
    try:
        year_str = satellite.tle_line1[9:11].strip()
        if year_str.isdigit():
            year = int(year_str)
            full_year = 1900 + year if year >= 57 else 2000 + year
            launch_date = f"{full_year}-01-01"
        else:
            launch_date = "2023-01-01"
    except Exception:
        launch_date = "2023-01-01"
        
    # 3. Determine country of origin
    country = "US"
    name_upper = satellite.name.upper()
    if any(k in name_upper for k in ("QIANFAN", "CZ-", "TIANGONG", "ZHUQUE", "LIJIAN")):
        country = "CN"
    elif any(k in name_upper for k in ("COSMOS", "SOYUZ", "FREGAT")):
        country = "RU"
    elif "ONEWEB" in name_upper:
        country = "GB"
    elif "ISS" in name_upper:
        country = "US/RU/ESA/JP"
    elif "INTELSAT" in name_upper:
        country = "LU"
    elif "ESTUBE" in name_upper:
        country = "FR"
    elif "STARLINK" in name_upper:
        country = "US"
    elif "GPS" in name_upper:
        country = "US"
        
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
        "launch_date": launch_date,
        "country": country,
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
    return [populate_satellite_extra_fields(sat) for sat in satellites]


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
    return [populate_satellite_extra_fields(sat) for sat in satellites]


@router.get("/{norad_id}", response_model=SatelliteResponse)
async def get_satellite(
    norad_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    result = await db.execute(select(SatelliteModel).where(SatelliteModel.norad_id == norad_id))
    satellite = result.scalar_one_or_none()
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found")
    return populate_satellite_extra_fields(satellite)
