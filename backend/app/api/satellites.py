from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.satellite import SatelliteModel
from app.schemas.satellite import SatelliteResponse

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


@router.get("", response_model=list[SatelliteResponse])
@router.get("/", response_model=list[SatelliteResponse], include_in_schema=False)
async def list_satellites(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    object_type: str | None = Query(default=None),
) -> list[SatelliteModel]:
    stmt = select(SatelliteModel).order_by(SatelliteModel.name).offset(offset).limit(limit)
    if object_type:
        stmt = stmt.where(SatelliteModel.object_type == object_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/search", response_model=list[SatelliteResponse])
async def search_satellites(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[SatelliteModel]:
    query = f"%{q.strip()}%"
    stmt = (
        select(SatelliteModel)
        .where(or_(SatelliteModel.name.ilike(query), SatelliteModel.norad_id.ilike(query)))
        .order_by(SatelliteModel.name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{norad_id}", response_model=SatelliteResponse)
async def get_satellite(
    norad_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SatelliteModel:
    result = await db.execute(select(SatelliteModel).where(SatelliteModel.norad_id == norad_id))
    satellite = result.scalar_one_or_none()
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found")
    return satellite
