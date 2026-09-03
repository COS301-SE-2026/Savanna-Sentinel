import math
from datetime import datetime, timedelta, timezone

from app.workers.ml.risk_engine import (
    _INCIDENT_FLOOR_BASE,
    _INCIDENT_FLOOR_HALF_LIFE_DAYS,
    _INCIDENT_FLOOR_RING_MULT,
    compute_incident_floors,
)

_NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)

_CELLS = [
    {"cell_id": "c00", "row": 0, "col": 0},
    {"cell_id": "c01", "row": 0, "col": 1},
    {"cell_id": "c10", "row": 1, "col": 0},
    {"cell_id": "far", "row": 10, "col": 10},
]


def _incident(days_ago, severity="high", source_tier="field_report"):
    return {
        "occurred_at": _NOW - timedelta(days=days_ago),
        "severity": severity,
        "source_tier": source_tier,
    }


def test_no_incidents_yields_no_floors():
    assert compute_incident_floors(_CELLS, {}, _NOW) == {}


def test_recent_field_report_floors_its_own_cell_by_severity():
    for severity in ("low", "medium", "high"):
        floors = compute_incident_floors(
            _CELLS,
            {"c00": [_incident(0, severity=severity)]},
            _NOW,
        )
        assert floors["c00"] == _INCIDENT_FLOOR_BASE[severity]


def test_null_severity_is_treated_as_low():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(0, severity=None)]},
        _NOW,
    )
    assert floors["c00"] == _INCIDENT_FLOOR_BASE["low"]


def test_floor_decays_with_a_thirty_day_half_life():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(_INCIDENT_FLOOR_HALF_LIFE_DAYS, severity="high")]},
        _NOW,
    )
    assert floors["c00"] == _INCIDENT_FLOOR_BASE["high"] / 2


def test_incident_older_than_ninety_days_is_ignored():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(100)]},
        _NOW,
    )
    assert "c00" not in floors


def test_future_incident_is_ignored():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(-5)]},
        _NOW,
    )
    assert "c00" not in floors


def test_floor_spreads_to_adjacent_cells_at_reduced_strength():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(0, severity="high")]},
        _NOW,
    )
    ring = _INCIDENT_FLOOR_BASE["high"] * _INCIDENT_FLOOR_RING_MULT
    assert floors["c01"] == ring
    assert floors["c10"] == ring


def test_non_adjacent_cell_gets_no_floor():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(0)]},
        _NOW,
    )
    assert "far" not in floors


def test_tipoff_floor_is_sixty_percent_of_a_field_report():
    floors = compute_incident_floors(
        _CELLS,
        {"c00": [_incident(0, severity="high", source_tier="tipoff")]},
        _NOW,
    )
    assert floors["c00"] == _INCIDENT_FLOOR_BASE["high"] * 0.6


def test_cell_takes_the_max_not_the_sum_of_multiple_incidents():
    incidents = [
        _incident(0, severity="medium"),
        _incident(0, severity="low"),
    ]
    floors = compute_incident_floors(_CELLS, {"c00": incidents}, _NOW)
    assert floors["c00"] == _INCIDENT_FLOOR_BASE["medium"]


def test_own_incident_outranks_a_neighbours_incident():
    floors = compute_incident_floors(
        _CELLS,
        {
            "c00": [_incident(0, severity="low")],
            "c01": [_incident(0, severity="high")],
        },
        _NOW,
    )
    expected = max(
        _INCIDENT_FLOOR_BASE["low"],
        _INCIDENT_FLOOR_BASE["high"] * _INCIDENT_FLOOR_RING_MULT,
    )
    assert floors["c00"] == expected
    assert math.isclose(expected, _INCIDENT_FLOOR_BASE["low"])
