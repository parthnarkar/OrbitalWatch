from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.conjunction import ConjunctionModel
from app.schemas.satellite import ConjunctionResponse
from app.services.conjunction import get_satellite_name, get_satellite_type

router = APIRouter(prefix="/api/conjunctions", tags=["conjunctions"])


async def serialize_conjunction(db: AsyncSession, conjunction: ConjunctionModel) -> ConjunctionResponse:
    return ConjunctionResponse(
        id=conjunction.id,
        sat1_norad_id=conjunction.sat1_norad_id,
        sat1_name=await get_satellite_name(db, conjunction.sat1_norad_id),
        sat1_type=await get_satellite_type(db, conjunction.sat1_norad_id),
        sat2_norad_id=conjunction.sat2_norad_id,
        sat2_name=await get_satellite_name(db, conjunction.sat2_norad_id),
        sat2_type=await get_satellite_type(db, conjunction.sat2_norad_id),
        approach_time=conjunction.approach_time,
        miss_distance_km=conjunction.miss_distance_km,
        risk_level=conjunction.risk_level,
        probability=conjunction.probability,
        relative_velocity=conjunction.relative_velocity,
    )


@router.get("", response_model=list[ConjunctionResponse])
@router.get("/", response_model=list[ConjunctionResponse], include_in_schema=False)
async def list_conjunctions(
    db: Annotated[AsyncSession, Depends(get_db)],
    risk_level: str | None = Query(default=None),
    hours_ahead: int = Query(default=72, ge=1, le=168),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[ConjunctionResponse]:
    until = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=hours_ahead)
    stmt = (
        select(ConjunctionModel)
        .where(ConjunctionModel.approach_time <= until)
        .order_by(ConjunctionModel.approach_time)
        .limit(limit)
    )
    if risk_level:
        stmt = stmt.where(ConjunctionModel.risk_level == risk_level.upper())
    result = await db.execute(stmt)
    return [await serialize_conjunction(db, item) for item in result.scalars().all()]


@router.delete("/clear")
async def clear_old_conjunctions(db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, int]:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    result = await db.execute(delete(ConjunctionModel).where(ConjunctionModel.created_at < cutoff))
    await db.commit()
    return {"deleted": result.rowcount or 0}


@router.get("/{conjunction_id}", response_model=ConjunctionResponse)
async def get_conjunction(
    conjunction_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConjunctionResponse:
    result = await db.execute(select(ConjunctionModel).where(ConjunctionModel.id == conjunction_id))
    conjunction = result.scalar_one_or_none()
    if conjunction is None:
        raise HTTPException(status_code=404, detail="Conjunction not found")
    return await serialize_conjunction(db, conjunction)
