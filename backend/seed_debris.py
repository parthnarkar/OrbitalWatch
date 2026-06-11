import asyncio
from app.core.database import AsyncSessionLocal
from app.services.tle_ingest import fetch_tle_from_celestrak
from app.models.satellite import Satellite
from sqlalchemy import select

async def seed_debris_only():
    db = AsyncSessionLocal()
    categories = ["debris", "1982-092", "1999-025", "iridium-33-debris", "cosmos-2251-debris", "rocket-body"]
    
    for cat in categories:
        try:
            tles = await fetch_tle_from_celestrak(cat)
            print(f"{cat}: {len(tles)} objects fetched")
            
            for tle in tles:
                # Check if exists
                result = await db.execute(select(Satellite).where(Satellite.norad_id == tle["norad_id"]))
                existing = result.scalar_one_or_none()
                
                # Correct type mapping: "rocket-body" maps to "rocket body", others in this list are "debris"
                obj_type = "rocket body" if cat == "rocket-body" else "debris"
                
                if not existing:
                    sat = Satellite(
                        norad_id=tle["norad_id"],
                        name=tle["name"],
                        object_type=obj_type,
                        tle_line1=tle["line1"],
                        tle_line2=tle["line2"]
                    )
                    db.add(sat)
            
            await db.commit()
            print(f"{cat}: committed to DB")
        except Exception as e:
            print(f"{cat}: ERROR - {e}")
            await db.rollback()
    
    await db.close()

if __name__ == "__main__":
    asyncio.run(seed_debris_only())
