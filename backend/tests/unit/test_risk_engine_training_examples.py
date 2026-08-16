from datetime import datetime, timedelta, timezone

from app.workers.ml.risk_engine import build_training_examples

_CELLS = [{"cell_id": "c00", "row": 0, "col": 0, "corners": []}]
_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
_END = datetime(2026, 3, 1, tzinfo=timezone.utc)


def test_generates_one_example_per_cell_per_step():
    examples = build_training_examples(
        _CELLS,
        {},
        {},
        _START,
        _END,
        step_days=7,
    )

    expected_steps = ((_END - _START).days // 7) + 1
    assert len(examples) == expected_steps


def test_every_example_has_a_feature_vector_and_label():
    examples = build_training_examples(
        _CELLS,
        {},
        {},
        _START,
        _END,
        step_days=30,
    )

    for example in examples:
        assert example["cell_id"] == "c00"
        assert set(example["features"].keys()) == {
            "incident_density_self",
            "incident_density_neighbors",
            "patrol_recency_days",
            "patrol_frequency",
        }
        assert example["label"] in (0, 1)


def test_label_is_1_when_incident_falls_in_label_window():
    reference_time = _START + timedelta(days=30)
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": reference_time + timedelta(days=5),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }

    examples = build_training_examples(
        _CELLS,
        incidents_by_cell,
        {},
        _START,
        _END,
        step_days=30,
        label_window_days=14,
    )

    matching = [e for e in examples if e["reference_time"] == reference_time]
    assert len(matching) == 1
    assert matching[0]["label"] == 1


def test_label_is_0_when_incident_falls_outside_label_window():
    reference_time = _START + timedelta(days=30)
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": reference_time + timedelta(days=20),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }

    examples = build_training_examples(
        _CELLS,
        incidents_by_cell,
        {},
        _START,
        _END,
        step_days=30,
        label_window_days=14,
    )

    matching = [e for e in examples if e["reference_time"] == reference_time]
    assert matching[0]["label"] == 0


def test_incident_before_reference_time_does_not_leak_into_label():
    reference_time = _START + timedelta(days=30)
    incidents_by_cell = {
        "c00": [
            {
                "occurred_at": reference_time - timedelta(days=1),
                "severity": "high",
                "source_tier": "field_report",
            },
        ],
    }

    examples = build_training_examples(
        _CELLS,
        incidents_by_cell,
        {},
        _START,
        _END,
        step_days=30,
        label_window_days=14,
    )

    matching = [e for e in examples if e["reference_time"] == reference_time]
    assert matching[0]["label"] == 0
    assert matching[0]["features"]["incident_density_self"] > 0
