import math
import random
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from app.workers.ml.risk_engine import (
    _compute_scale_pos_weight,
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
                    "sighting_density_self": rng.uniform(0, 3),
                    "sighting_density_neighbors": rng.uniform(0, 2),
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
            "sighting_density_self": 0.0,
            "sighting_density_neighbors": 0.0,
        },
        "low_risk": {
            "incident_density_self": 0.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 1.0,
            "patrol_frequency": 8.0,
            "sighting_density_self": 0.0,
            "sighting_density_neighbors": 0.0,
        },
    }

    scores = score_cells(model, features_per_cell)

    assert set(scores.keys()) == {"high_risk", "low_risk"}
    assert 0.0 <= scores["high_risk"] <= 1.0
    assert 0.0 <= scores["low_risk"] <= 1.0
    assert scores["high_risk"] > scores["low_risk"]


def test_scale_pos_weight_dampens_extreme_imbalance_with_sqrt():
    y_train = np.array([1] + [0] * 399)

    weight = _compute_scale_pos_weight(y_train)

    assert weight == pytest.approx(math.sqrt(399))


def test_scale_pos_weight_capped_for_pathological_imbalance():
    y_train = np.array([1] + [0] * 100_000)

    weight = _compute_scale_pos_weight(y_train)

    assert weight == 50.0


def test_scale_pos_weight_falls_back_to_one_when_no_positives():
    y_train = np.array([0] * 50)

    weight = _compute_scale_pos_weight(y_train)

    assert weight == 1.0


def test_monotone_constraint_prevents_inverted_incident_density_relationship():
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    density_label_pairs = [
        (0.5, 1),
        (9.0, 0),
        (0.6, 1),
        (8.5, 0),
        (0.4, 0),
        (9.5, 0),
    ]
    examples = [
        {
            "cell_id": f"c{i}",
            "reference_time": base_time + timedelta(days=i),
            "features": {
                "incident_density_self": density,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
            "label": label,
        }
        for i, (density, label) in enumerate(density_label_pairs)
    ]

    model_bytes, _ = train_model(examples)
    model = load_model(model_bytes)

    scores = score_cells(
        model,
        {
            "low": {
                "incident_density_self": 0.5,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
            "high": {
                "incident_density_self": 9.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
        },
    )

    assert scores["high"] >= scores["low"]


def test_monotone_constraint_produces_differentiated_scores_not_a_constant():
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    density_label_pairs = [
        (0.5, 0),
        (1.5, 0),
        (2.5, 0),
        (3.5, 1),
        (4.5, 0),
        (5.5, 1),
        (6.5, 1),
        (7.5, 0),
        (8.5, 1),
        (9.5, 1),
    ]
    examples = [
        {
            "cell_id": f"c{i}",
            "reference_time": base_time + timedelta(days=i),
            "features": {
                "incident_density_self": density,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
            "label": label,
        }
        for i, (density, label) in enumerate(density_label_pairs)
    ]

    model_bytes, _ = train_model(examples)
    model = load_model(model_bytes)

    scores = score_cells(
        model,
        {
            "low": {
                "incident_density_self": 0.5,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
            "high": {
                "incident_density_self": 9.5,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
        },
    )

    assert scores["high"] > scores["low"]


def test_monotone_constraint_enforces_negative_patrol_frequency_direction():
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    frequency_label_pairs = [
        (9, 1),
        (0, 0),
        (8, 1),
        (1, 0),
        (0, 0),
        (10, 0),
    ]
    examples = [
        {
            "cell_id": f"c{i}",
            "reference_time": base_time + timedelta(days=i),
            "features": {
                "incident_density_self": 1.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": frequency,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
            "label": label,
        }
        for i, (frequency, label) in enumerate(frequency_label_pairs)
    ]

    model_bytes, _ = train_model(examples)
    model = load_model(model_bytes)

    scores = score_cells(
        model,
        {
            "rarely_patrolled": {
                "incident_density_self": 1.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 0.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
            "frequently_patrolled": {
                "incident_density_self": 1.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 9.0,
                "sighting_density_self": 0.0,
                "sighting_density_neighbors": 0.0,
            },
        },
    )

    assert scores["rarely_patrolled"] >= scores["frequently_patrolled"]


def test_monotone_constraint_prevents_inverted_sighting_density_relationship():
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    density_label_pairs = [
        (0.5, 1),
        (9.0, 0),
        (0.6, 1),
        (8.5, 0),
        (0.4, 0),
        (9.5, 0),
    ]
    examples = [
        {
            "cell_id": f"c{i}",
            "reference_time": base_time + timedelta(days=i),
            "features": {
                "incident_density_self": 0.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": density,
                "sighting_density_neighbors": 0.0,
            },
            "label": label,
        }
        for i, (density, label) in enumerate(density_label_pairs)
    ]

    model_bytes, _ = train_model(examples)
    model = load_model(model_bytes)

    scores = score_cells(
        model,
        {
            "low": {
                "incident_density_self": 0.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 0.5,
                "sighting_density_neighbors": 0.0,
            },
            "high": {
                "incident_density_self": 0.0,
                "incident_density_neighbors": 0.0,
                "patrol_recency_days": 10.0,
                "patrol_frequency": 5.0,
                "sighting_density_self": 9.0,
                "sighting_density_neighbors": 0.0,
            },
        },
    )

    assert scores["high"] >= scores["low"]
