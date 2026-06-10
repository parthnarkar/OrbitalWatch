from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.satellite import SatelliteModel
from app.schemas.satellite import PositionResponse
from app.services.propagation import ensure_utc, propagate_satellite

router = APIRouter(prefix="/api/propagate", tags=["propagation"])


@router.get("/{norad_id}", response_model=PositionResponse)
async def propagate_by_norad(
    norad_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    at: datetime | None = Query(default=None),
) -> dict[str, object]:
    result = await db.execute(select(SatelliteModel).where(SatelliteModel.norad_id == norad_id))
    satellite = result.scalar_one_or_none()
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found")

    position = propagate_satellite(satellite, ensure_utc(at))
    if position is None:
        raise HTTPException(status_code=422, detail="Unable to propagate satellite TLE")

    vector = {
        "latitude": position["latitude"],
        "longitude": position["longitude"],
        "altitude_km": position["altitude_km"],
        "velocity_kms": position["velocity_kms"],
    }
    return {
        "norad_id": satellite.norad_id,
        "name": satellite.name,
        "timestamp": position["timestamp"],
        **vector,
        "position": vector,
        "orbital_period_min": position["orbital_period_min"],
        "object_type": satellite.object_type,
    }
