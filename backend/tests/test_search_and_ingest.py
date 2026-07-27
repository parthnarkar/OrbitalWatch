from __future__ import annotations

import pytest
from app.services.tle_ingest import determine_object_type


def test_determine_object_type_classification() -> None:
    assert determine_object_type("STARLINK-1007", "weather") == "payload"
    assert determine_object_type("COSMOS 2251 DEB", "debris") == "debris"
    assert determine_object_type("FALCON 9 R/B", "") == "rocket body"
    assert determine_object_type("UNKNOWN OBJECT 1", "") == "unknown"


@pytest.mark.asyncio
async def test_ingest_satellites_success(db_session) -> None:
    from unittest.mock import patch
    from app.services.tle_ingest import ingest_satellites
    from app.models.satellite import SatelliteModel
    from sqlalchemy import select

    mock_tle_records = [
        {
            "name": "TEST STARLINK",
            "norad_id": "43001",
            "line1": "1 43001U 18001A   24001.00000000  .00000000  00000-0  00000-0 0  9993",
            "line2": "2 43001  53.0000   0.0000 0001000   0.0000   0.0000 15.00000000123456",
        }
    ]

    from app.services.tle_ingest import CELESTRAK_GROUPS

    with patch("app.services.tle_ingest.fetch_tle_from_celestrak") as mock_fetch:
        # Return mock records for the first group, then empty lists for subsequent groups
        mock_fetch.side_effect = lambda cat: mock_tle_records if cat == CELESTRAK_GROUPS[0] else []

        ingested = await ingest_satellites(db_session)
        
        # Verify ingestion count (only the one mocked satellite should be ingested)
        assert ingested == 1

        # Query sat from DB and verify it has the real TLE lines as-is!
        result = await db_session.execute(
            select(SatelliteModel).where(SatelliteModel.norad_id == "43001")
        )
        sat = result.scalar_one_or_none()
        assert sat is not None
        assert sat.name == "TEST STARLINK"
        assert sat.tle_line1 == mock_tle_records[0]["line1"]
        assert sat.tle_line2 == mock_tle_records[0]["line2"]
        assert sat.object_type == "payload"

