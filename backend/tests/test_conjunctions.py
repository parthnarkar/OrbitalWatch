from __future__ import annotations

from app.services.conjunction import collision_probability, risk_from_distance


def test_risk_thresholds() -> None:
    assert risk_from_distance(0.05) == "HIGH"
    assert risk_from_distance(0.25) == "MEDIUM"
    assert risk_from_distance(0.75) == "LOW"
    assert risk_from_distance(1.0) is None


def test_collision_probability_is_bounded() -> None:
    assert 0.0 <= collision_probability(100.0, 7.5) <= 1.0
    assert collision_probability(0.001, 20.0) == 1.0
