from __future__ import annotations

from datetime import datetime, timezone

from app.models.satellite import SatelliteModel
from app.services.propagation import propagate_satellite


def test_iss_propagation_reasonable_orbit() -> None:
    satellite = SatelliteModel(
        norad_id="25544",
        name="ISS (ZARYA)",
        object_type="payload",
        tle_line1="1 25544U 98067A   24155.90847222  .00016717  00000+0  30619-3 0  9993",
        tle_line2="2 25544  51.6416  43.2200 0005617  80.0123  26.4529 15.50000000450000",
    )
    position = propagate_satellite(satellite, datetime(2024, 6, 4, tzinfo=timezone.utc))
    assert position is not None
    assert 380 <= position["altitude_km"] <= 460
    assert 7.4 <= position["velocity_kms"] <= 7.9
