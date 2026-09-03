from datetime import datetime, timedelta, timezone

import pytest

from app.workers.ml.risk_engine import (
    _NEIGHBOR_DISTANCE_DECAY,
    _NEIGHBOR_WEIGHT_MULTIPLIER,
    FEATURE_NAMES,
    compute_cell_features,
)

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
        "sighting_density_self",
        "sighting_density_neighbors",
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


def test_future_incidents_are_excluded():
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": _NOW + timedelta(days=5),
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


def test_neighbor_density_is_weighted_and_decays_with_distance():
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=1),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }
    cells = _CELLS + [{"cell_id": "c02", "row": 0, "col": 2, "corners": []}]

    features = compute_cell_features(cells, incidents_by_cell, {}, _NOW)

    self_density = features["c00"]["incident_density_self"]
    distance_1_density = features["c01"]["incident_density_neighbors"]
    distance_2_density = features["c02"]["incident_density_neighbors"]

    assert distance_1_density == pytest.approx(
        self_density * _NEIGHBOR_WEIGHT_MULTIPLIER,
    )
    assert distance_2_density == pytest.approx(
        self_density * _NEIGHBOR_WEIGHT_MULTIPLIER * _NEIGHBOR_DISTANCE_DECAY,
    )
    assert distance_1_density > distance_2_density


def test_patrol_recency_and_frequency():
    patrol_by_cell = {
        "c00": [_NOW - timedelta(days=10), _NOW - timedelta(days=3)],
    }

    features = compute_cell_features(_CELLS, {}, patrol_by_cell, _NOW)

    assert features["c00"]["patrol_frequency"] == 2
    assert features["c00"]["patrol_recency_days"] == 3


def test_cell_with_no_sightings_gets_zero_sighting_density():
    features = compute_cell_features(_CELLS, {}, {}, _NOW)

    assert features["far"]["sighting_density_self"] == 0.0
    assert features["far"]["sighting_density_neighbors"] == 0.0


def test_self_sighting_contributes_to_its_own_cell_and_neighbors():
    sightings_by_cell = {
        "c00": [{"occurred_at": _NOW - timedelta(days=1), "count": 1}],
    }

    features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["sighting_density_self"] > 0
    assert features["c01"]["sighting_density_self"] == 0.0
    assert features["c01"]["sighting_density_neighbors"] > 0
    assert features["far"]["sighting_density_neighbors"] == 0.0


def test_sightings_outside_lookback_window_are_excluded():
    sightings_by_cell = {
        "c00": [{"occurred_at": _NOW - timedelta(days=200), "count": 1}],
    }

    features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        lookback_days=90,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["sighting_density_self"] == 0.0


def test_future_sightings_are_excluded():
    sightings_by_cell = {
        "c00": [{"occurred_at": _NOW + timedelta(days=5), "count": 1}],
    }

    features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        lookback_days=90,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["sighting_density_self"] == 0.0


def test_larger_herd_count_increases_sighting_density_sublinearly():
    lone = {"c00": [{"occurred_at": _NOW - timedelta(days=1), "count": 1}]}
    herd = {"c00": [{"occurred_at": _NOW - timedelta(days=1), "count": 20}]}

    lone_features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        sightings_by_cell=lone,
    )
    herd_features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        sightings_by_cell=herd,
    )

    lone_density = lone_features["c00"]["sighting_density_self"]
    herd_density = herd_features["c00"]["sighting_density_self"]

    assert herd_density > lone_density
    assert herd_density < lone_density * 20


def test_incident_and_sighting_density_are_independent():
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": _NOW - timedelta(days=1),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }
    sightings_by_cell = {
        "c00": [{"occurred_at": _NOW - timedelta(days=1), "count": 1}],
    }

    features = compute_cell_features(
        _CELLS,
        incidents_by_cell,
        {},
        _NOW,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["incident_density_self"] > 0
    assert features["c00"]["sighting_density_self"] > 0


def test_sighting_older_than_one_week_is_excluded():
    sightings_by_cell = {
        "c00": [{"occurred_at": _NOW - timedelta(days=10), "count": 5}],
    }

    features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["sighting_density_self"] == 0.0
    assert features["c01"]["sighting_density_neighbors"] == 0.0


def test_sighting_within_the_week_still_contributes():
    sightings_by_cell = {
        "c00": [{"occurred_at": _NOW - timedelta(days=6), "count": 1}],
    }

    features = compute_cell_features(
        _CELLS,
        {},
        {},
        _NOW,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["sighting_density_self"] > 0


def test_a_week_old_incident_still_counts_even_though_a_sighting_would_not():
    occurred_at = _NOW - timedelta(days=10)
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": occurred_at,
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }
    sightings_by_cell = {"c00": [{"occurred_at": occurred_at, "count": 5}]}

    features = compute_cell_features(
        _CELLS,
        incidents_by_cell,
        {},
        _NOW,
        sightings_by_cell=sightings_by_cell,
    )

    assert features["c00"]["incident_density_self"] > 0
    assert features["c00"]["sighting_density_self"] == 0.0
