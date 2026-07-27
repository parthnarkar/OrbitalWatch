import pytest
from app.services.conjunction import collision_probability, risk_from_distance
import math
from datetime import datetime, timezone


def test_risk_thresholds() -> None:
    assert risk_from_distance(0.05) == "HIGH"
    assert risk_from_distance(0.25) == "MEDIUM"
    assert risk_from_distance(0.75) == "LOW"
    assert risk_from_distance(1.0) is None


def test_collision_probability_is_bounded() -> None:
    assert 0.0 <= collision_probability(100.0, 7.5) <= 1.0
    assert collision_probability(0.001, 20.0) == 1.0


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
    raan: float = 0.0,
) -> tuple[str, str]:
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
        f"2 {nid} {inclination:8.4f} {raan:8.4f} {ecc_str} "
        f"0.0000 0.0000 {mean_motion:11.8f}00001"
    )
    l2_chk = compute_tle_checksum(l2_part)
    line2 = f"{l2_part}{l2_chk}"
    return line1, line2


@pytest.mark.asyncio
async def test_scan_conjunctions(db_session) -> None:
    import pytest
    from app.models.satellite import SatelliteModel
    from app.models.conjunction import ConjunctionModel
    from app.services.conjunction import scan_conjunctions
    from sqlalchemy import delete

    # Ensure database is clean of other tests' satellites/conjunctions
    await db_session.execute(delete(SatelliteModel))
    await db_session.execute(delete(ConjunctionModel))
    await db_session.commit()

    # Generate two satellites in very close orbits to trigger a conjunction
    l1_a, l2_a = generate_valid_tle(
        norad_id="11111",
        name="CONJ SAT A",
        inclination=45.0,
        altitude_km=500.0,
        eccentricity=0.0001,
        raan=0.0,
    )
    l1_b, l2_b = generate_valid_tle(
        norad_id="22222",
        name="CONJ SAT B",
        inclination=45.0,
        altitude_km=500.1,  # extremely close
        eccentricity=0.0001,
        raan=0.01,         # slight offset to ensure overlap scan hits it
    )

    sat_a = SatelliteModel(
        norad_id="11111",
        name="CONJ SAT A",
        object_type="payload",
        tle_line1=l1_a,
        tle_line2=l2_a,
    )
    sat_b = SatelliteModel(
        norad_id="22222",
        name="CONJ SAT B",
        object_type="payload",
        tle_line1=l1_b,
        tle_line2=l2_b,
    )

    db_session.add_all([sat_a, sat_b])
    await db_session.commit()

    # Run conjunction scan
    conjunctions = await scan_conjunctions(db_session, hours_ahead=24, interval_minutes=5)
    
    # We expect a conjunction to be detected due to the very close orbit
    assert len(conjunctions) > 0
    conjunction = conjunctions[0]
    assert conjunction.sat1_norad_id in ("11111", "22222")
    assert conjunction.sat2_norad_id in ("11111", "22222")
    assert conjunction.miss_distance_km < 1.0
    assert conjunction.risk_level in ("HIGH", "MEDIUM", "LOW")

