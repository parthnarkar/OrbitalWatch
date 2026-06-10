from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.satellite import SatelliteModel
from app.schemas.satellite import SatelliteResponse

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


@router.get("/", response_model=List[SatelliteResponse])
async def list_satellites(db: AsyncSession = Depends(get_db)) -> List[SatelliteResponse]:
    result = await db.execute(select(SatelliteModel).order_by(SatelliteModel.name))
    satellites = result.scalars().all()
    return [SatelliteResponse.model_validate(satellite) for satellite in satellites]


@router.get("/{norad_id}", response_model=SatelliteResponse)
async def get_satellite(norad_id: str, db: AsyncSession = Depends(get_db)) -> SatelliteResponse:
    result = await db.execute(select(SatelliteModel).where(SatelliteModel.norad_id == norad_id))
    satellite = result.scalar_one_or_none()
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found")
    return SatelliteResponse.model_validate(satellite)


@router.get("/search", response_model=List[SatelliteResponse])
async def search_satellites(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
) -> List[SatelliteResponse]:
    result = await db.execute(
        select(SatelliteModel)
        .where(SatelliteModel.name.ilike(f"%{q}%"))
        .order_by(SatelliteModel.name)
        .limit(20)
    )
    satellites = result.scalars().all()
    return [SatelliteResponse.model_validate(satellite) for satellite in satellites]
