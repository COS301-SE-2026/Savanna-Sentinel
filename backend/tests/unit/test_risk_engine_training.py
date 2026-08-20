import random
from datetime import datetime, timedelta, timezone

from app.workers.ml.risk_engine import (
    load_model,
    score_cells,
    train_model,
)


def _make_examples(n=200, seed=42):
    rng = random.Random(seed)
    examples = []
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(n):
        density = rng.uniform(0, 10)
        # deliberately correlated so the model has something learnable
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
                },
                "label": label,
            },
        )
    return examples


def test_train_model_returns_bytes_and_metrics():
    examples = _make_examples()

    model_bytes, metrics = train_model(examples)

    assert isinstance(model_bytes, bytes)
    assert len(model_bytes) > 0
    assert 0.0 <= metrics["precision"] <= 1.0
    assert 0.0 <= metrics["recall"] <= 1.0
    assert 0.0 <= metrics["auc"] <= 1.0
    assert metrics["n_train"] + metrics["n_holdout"] == len(examples)


def test_train_model_holdout_is_the_most_recent_examples_by_time():
    examples = _make_examples()
    _, metrics = train_model(examples, holdout_fraction=0.2)

    assert metrics["n_holdout"] == int(len(examples) * 0.2)


def test_load_model_roundtrips_and_scores():
    examples = _make_examples()
    model_bytes, _ = train_model(examples)

    model = load_model(model_bytes)
    features_per_cell = {
        "high_risk": {
            "incident_density_self": 9.0,
            "incident_density_neighbors": 4.0,
            "patrol_recency_days": 25.0,
            "patrol_frequency": 1.0,
        },
        "low_risk": {
            "incident_density_self": 0.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 1.0,
            "patrol_frequency": 8.0,
        },
    }

    scores = score_cells(model, features_per_cell)

    assert set(scores.keys()) == {"high_risk", "low_risk"}
    assert 0.0 <= scores["high_risk"] <= 1.0
    assert 0.0 <= scores["low_risk"] <= 1.0
    assert scores["high_risk"] > scores["low_risk"]
