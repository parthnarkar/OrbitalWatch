from __future__ import annotations

import pytest
from app.services.tle_ingest import (
    compute_tle_checksum,
    determine_object_type,
    generate_fallback_tles,
    generate_valid_tle,
)


def test_tle_checksum_calculation() -> None:
    # Standard TLE line 1 for ISS
    line1_body = "1 25544U 98067A   24155.90847222  .00016717  00000+0  30619-3 0  999"
    chk = compute_tle_checksum(line1_body)
    assert 0 <= chk <= 9


def test_determine_object_type_classification() -> None:
    assert determine_object_type("STARLINK-1007", "active") == "payload"
    assert determine_object_type("COSMOS 2251 DEB", "debris") == "debris"
    assert determine_object_type("FALCON 9 R/B", "") == "rocket body"
    assert determine_object_type("UNKNOWN OBJECT 1", "") == "unknown"


def test_generate_valid_tle_structure() -> None:
    l1, l2 = generate_valid_tle(
        norad_id="25544",
        name="ISS (ZARYA)",
        inclination=51.64,
        altitude_km=420.0,
    )
    assert l1.startswith("1 25544U")
    assert l2.startswith("2 25544")
    assert len(l1) >= 68
    assert len(l2) >= 68


def test_generate_fallback_tles_count_and_types() -> None:
    fallbacks = generate_fallback_tles()
    assert len(fallbacks) > 50
    types = {f["object_type"] for f in fallbacks}
    assert "payload" in types
    assert "debris" in types
    assert "rocket body" in types
    assert "unknown" in types
