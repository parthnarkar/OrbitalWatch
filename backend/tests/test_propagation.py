from __future__ import annotations

from datetime import datetime, timezone

from app.models.satellite import SatelliteModel
from app.services.propagation import propagate_satellite
from app.services.tle_ingest import generate_valid_tle, determine_object_type


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


def test_custom_tle_generation_and_propagation() -> None:
    types_to_test = ["payload", "debris", "rocket body", "unknown"]
    for i, obj_type in enumerate(types_to_test):
        nid = str(95000 + i)
        # Choose names that map correctly using our determine_object_type helper
        if obj_type == "payload":
            name = "TEST SATELLITE"
        elif obj_type == "debris":
            name = "TEST DEB"
        elif obj_type == "rocket body":
            name = "TEST R/B"
        else:
            name = "TEST UNKNOWN"

        l1, l2 = generate_valid_tle(
            nid,
            name,
            inclination=45.0 + i * 10.0,
            altitude_km=500.0 + i * 150.0,
            eccentricity=0.001,
        )
        
        # Verify classification matches
        assert determine_object_type(name, "") == obj_type

        # Build model and test propagation
        sat = SatelliteModel(
            norad_id=nid,
            name=name,
            object_type=obj_type,
            tle_line1=l1,
            tle_line2=l2,
        )
        pos = propagate_satellite(sat, datetime(2026, 6, 11, tzinfo=timezone.utc))
        assert pos is not None
        assert pos["altitude_km"] > 0
        assert pos["velocity_kms"] > 0

