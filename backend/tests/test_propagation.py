from __future__ import annotations

from datetime import datetime, timezone

from app.models.satellite import SatelliteModel
from app.services.propagation import propagate_satellite
from app.services.tle_ingest import determine_object_type
import math


def compute_tle_checksum(line: str) -> int:
    total = 0
    for char in line[:68]:
        if char.isdigit():
            total += int(char)
        elif char == "-":
            total += 1
    return total % 10


def generate_valid_tle(
    norad_id: str,
    name: str,
    inclination: float,
    altitude_km: float,
    eccentricity: float = 0.0001,
) -> tuple[str, str]:
    import random
    utcnow = datetime.now(timezone.utc)
    RE = 6378.137
    GM = 398600.4418
    a = RE + altitude_km
    period_sec = 2 * math.pi * math.sqrt((a ** 3) / GM)
    mean_motion = 86400.0 / period_sec
    nid = f"{int(norad_id):05d}"
    year2 = utcnow.year % 100
    day_of_year = utcnow.timetuple().tm_yday
    frac_day = 0.5
    epoch_str = f"{year2:02d}{day_of_year + frac_day:012.8f}"
    l1_template = f"1 {nid}U 23001A   {epoch_str}  .00000000  00000-0  00000-0 0  999"
    l1_chk = compute_tle_checksum(l1_template)
    line1 = f"{l1_template}{l1_chk}"
    ecc_int = int(eccentricity * 10_000_000)
    ecc_str = f"{ecc_int:07d}"[:7]
    l2_part = (
        f"2 {nid} {inclination:8.4f} 0.0000 {ecc_str} "
        f"0.0000 0.0000 {mean_motion:11.8f}00001"
    )
    l2_chk = compute_tle_checksum(l2_part)
    line2 = f"{l2_part}{l2_chk}"
    return line1, line2


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
        pos = propagate_satellite(sat, datetime.now(timezone.utc))
        assert pos is not None
        assert pos["altitude_km"] > 0
        assert pos["velocity_kms"] > 0


def test_propagation_fails_gracefully_with_corrupt_tle() -> None:
    # Invalid TLE line format (completely corrupt text)
    satellite = SatelliteModel(
        norad_id="99999",
        name="CORRUPT SATELLITE",
        object_type="payload",
        tle_line1="This is a completely broken line 1",
        tle_line2="This is a completely broken line 2",
    )
    position = propagate_satellite(satellite, datetime(2026, 6, 11, tzinfo=timezone.utc))
    assert position is None


