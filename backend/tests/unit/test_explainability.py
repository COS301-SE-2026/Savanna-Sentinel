import random
from datetime import datetime, timedelta, timezone

from app.workers.ml.explainability import explain_cells
from app.workers.ml.risk_engine import FEATURE_NAMES, load_model, train_model


def _make_examples(n=150, seed=7):
    rng = random.Random(seed)
    examples = []
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(n):
        density = rng.uniform(0, 10)
        label = 1 if density > 6 and rng.random() > 0.2 else 0
        examples.append(
            {
                "cell_id": f"c{i % 20}",
                "reference_time": base_time + timedelta(days=i),
                "features": {
                    "incident_density_self": density,
                    "incident_density_neighbors": rng.uniform(0, 5),
                    "patrol_recency_days": rng.uniform(0, 30),
                    "patrol_frequency": rng.uniform(0, 10),
                    "sighting_density_self": rng.uniform(0, 3),
                    "sighting_density_neighbors": rng.uniform(0, 2),
                },
                "label": label,
            },
        )
    return examples


def _trained_model():
    model_bytes, _ = train_model(_make_examples())
    return load_model(model_bytes)


def test_explain_cells_returns_top_n_features_per_cell():
    model = _trained_model()
    features_per_cell = {
        "c1": {
            "incident_density_self": 9.0,
            "incident_density_neighbors": 4.0,
            "patrol_recency_days": 25.0,
            "patrol_frequency": 1.0,
            "sighting_density_self": 0.0,
            "sighting_density_neighbors": 0.0,
        },
    }

    result = explain_cells(model, features_per_cell, top_n=2)

    assert list(result.keys()) == ["c1"]
    assert len(result["c1"]) == 2
    for feature_name, contribution in result["c1"]:
        assert feature_name in FEATURE_NAMES
        assert 0.0 <= contribution <= 1.0


def test_explain_cells_sorted_by_contribution_descending():
    model = _trained_model()
    features_per_cell = {
        "c1": {
            "incident_density_self": 9.5,
            "incident_density_neighbors": 0.1,
            "patrol_recency_days": 1.0,
            "patrol_frequency": 9.0,
            "sighting_density_self": 0.0,
            "sighting_density_neighbors": 0.0,
        },
    }

    result = explain_cells(model, features_per_cell, top_n=4)

    contributions = [c for _, c in result["c1"]]
    assert contributions == sorted(contributions, reverse=True)


def test_explain_cells_handles_multiple_cells_independently():
    model = _trained_model()
    features_per_cell = {
        "high": {
            "incident_density_self": 9.0,
            "incident_density_neighbors": 4.0,
            "patrol_recency_days": 25.0,
            "patrol_frequency": 1.0,
            "sighting_density_self": 0.0,
            "sighting_density_neighbors": 0.0,
        },
        "low": {
            "incident_density_self": 0.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 1.0,
            "patrol_frequency": 8.0,
            "sighting_density_self": 0.0,
            "sighting_density_neighbors": 0.0,
        },
    }

    result = explain_cells(model, features_per_cell, top_n=3)

    assert set(result.keys()) == {"high", "low"}
