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


async def serialize_conjunction(
    db: AsyncSession,
    conjunction: ConjunctionModel,
    sat_map: dict[str, tuple[str, str]] | None = None,
) -> ConjunctionResponse:
    if sat_map and conjunction.sat1_norad_id in sat_map:
        sat1_name, sat1_type = sat_map[conjunction.sat1_norad_id]
    else:
        sat1_name = await get_satellite_name(db, conjunction.sat1_norad_id)
        sat1_type = await get_satellite_type(db, conjunction.sat1_norad_id)

    if sat_map and conjunction.sat2_norad_id in sat_map:
        sat2_name, sat2_type = sat_map[conjunction.sat2_norad_id]
    else:
        sat2_name = await get_satellite_name(db, conjunction.sat2_norad_id)
        sat2_type = await get_satellite_type(db, conjunction.sat2_norad_id)

    return ConjunctionResponse(
        id=conjunction.id,
        sat1_norad_id=conjunction.sat1_norad_id,
        sat1_name=sat1_name,
        sat1_type=sat1_type,
        sat2_norad_id=conjunction.sat2_norad_id,
        sat2_name=sat2_name,
        sat2_type=sat2_type,
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
    conjunctions = list(result.scalars().all())
    if not conjunctions:
        return []

    # Gather all unique norad_ids in a bulk list
    norad_ids = set()
    for c in conjunctions:
        norad_ids.add(c.sat1_norad_id)
        norad_ids.add(c.sat2_norad_id)

    # Fetch names and types in a single bulk query
    from app.models.satellite import SatelliteModel
    sat_stmt = select(SatelliteModel.norad_id, SatelliteModel.name, SatelliteModel.object_type).where(
        SatelliteModel.norad_id.in_(list(norad_ids))
    )
    sat_result = await db.execute(sat_stmt)
    sat_map = {row[0]: (row[1], row[2]) for row in sat_result.all()}

    return [await serialize_conjunction(db, item, sat_map) for item in conjunctions]


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
