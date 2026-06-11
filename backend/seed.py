from __future__ import annotations

import asyncio

import os

from sqlalchemy import func, select
from alembic import command
from alembic.config import Config
from app.core.database import AsyncSessionLocal
from app.models.satellite import SatelliteModel
from app.services.tle_ingest import ingest_satellites


async def main() -> None:
    async with AsyncSessionLocal() as session:
        count = await ingest_satellites(session)
        payloads = await session.scalar(
            select(func.count(SatelliteModel.id)).where(SatelliteModel.object_type == "payload")
        )
        debris = await session.scalar(
            select(func.count(SatelliteModel.id)).where(SatelliteModel.object_type == "debris")
        )
        rocket_bodies = await session.scalar(
            select(func.count(SatelliteModel.id)).where(SatelliteModel.object_type == "rocket body")
        )

    print(f"Ingested {count} satellites")
    print(f"Total: {payloads or 0} payloads, {debris or 0} debris, {rocket_bodies or 0} rocket bodies")


if __name__ == "__main__":
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    asyncio.run(main())

