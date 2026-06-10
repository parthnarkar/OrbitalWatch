from __future__ import annotations

import asyncio

from app.core.database import AsyncSessionLocal, init_db
from app.services.tle_ingest import ingest_satellites


async def main() -> None:
    await init_db()
    async with AsyncSessionLocal() as session:
        count = await ingest_satellites(session)
    print(f"Ingested {count} satellites")


if __name__ == "__main__":
    asyncio.run(main())
