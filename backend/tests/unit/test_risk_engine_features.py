from datetime import datetime, timedelta, timezone

from app.workers.ml.risk_engine import FEATURE_NAMES, compute_cell_features

_NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)

_CELLS = [
    {"cell_id": "c00", "row": 0, "col": 0, "corners": []},
    {"cell_id": "c01", "row": 0, "col": 1, "corners": []},
    {"cell_id": "c10", "row": 1, "col": 0, "corners": []},
    {"cell_id": "far", "row": 10, "col": 10, "corners": []},
]


def test_feature_names_are_fixed_order():
    assert FEATURE_NAMES == [
        "incident_density_self",
        "incident_density_neighbors",
        "patrol_recency_days",
        "patrol_frequency",
    ]


def test_cell_with_no_data_gets_zero_density_and_sentinel_recency():
    features = compute_cell_features(_CELLS, {}, {}, _NOW)

    assert features["far"]["incident_density_self"] == 0.0
    assert features["far"]["incident_density_neighbors"] == 0.0
    assert features["far"]["patrol_frequency"] == 0
    assert features["far"]["patrol_recency_days"] > 365


def test_self_incident_contributes_only_to_its_own_cell_and_neighbors():
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=1),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }

    features = compute_cell_features(_CELLS, incidents_by_cell, {}, _NOW)

    assert features["c00"]["incident_density_self"] > 0
    assert features["c01"]["incident_density_self"] == 0.0
    assert features["c01"]["incident_density_neighbors"] > 0
    assert features["far"]["incident_density_neighbors"] == 0.0


def test_incidents_outside_lookback_window_are_excluded():
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=200),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }

    features = compute_cell_features(
        _CELLS,
        incidents_by_cell,
        {},
        _NOW,
        lookback_days=90,
    )

    assert features["c00"]["incident_density_self"] == 0.0


def test_more_recent_incident_weighs_more_than_older_one():
    recent = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=2),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }
    old = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=80),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }

    recent_features = compute_cell_features(_CELLS, recent, {}, _NOW)
    old_features = compute_cell_features(_CELLS, old, {}, _NOW)

    assert (
        recent_features["c00"]["incident_density_self"]
        > old_features["c00"]["incident_density_self"]
    )


def test_field_report_sourced_weighs_more_than_tipoff_sourced():
    fr = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=2),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }
    tip = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=2),
                "severity": "high",
                "source_tier": "tipoff",
            },
        ],
    }

    fr_features = compute_cell_features(_CELLS, fr, {}, _NOW)
    tip_features = compute_cell_features(_CELLS, tip, {}, _NOW)

    assert (
        fr_features["c00"]["incident_density_self"]
        > tip_features["c00"]["incident_density_self"]
    )


def test_patrol_recency_and_frequency():
    patrol_by_cell = {
        "c00": [_NOW - timedelta(days=10), _NOW - timedelta(days=3)],
    }

    features = compute_cell_features(_CELLS, {}, patrol_by_cell, _NOW)

    assert features["c00"]["patrol_frequency"] == 2
    assert features["c00"]["patrol_recency_days"] == 3
