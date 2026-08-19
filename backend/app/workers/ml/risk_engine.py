import math
from datetime import datetime, timedelta

import numpy as np
import xgboost as xgb
from sklearn.metrics import precision_score, recall_score, roc_auc_score

FEATURE_NAMES = [
    "incident_density_self",
    "incident_density_neighbors",
    "patrol_recency_days",
    "patrol_frequency",
]

_SEVERITY_WEIGHT = {"low": 1.0, "medium": 2.0, "high": 3.0, None: 1.0}
_SOURCE_WEIGHT = {"field_report": 1.0, "tipoff": 0.6}
_RECENCY_HALF_LIFE_DAYS = 14.0
_NO_PATROL_RECENCY_SENTINEL_DAYS = 999.0


def _incident_weight(incident: dict, reference_time: datetime) -> float:
    seconds_ago = (reference_time - incident["occurred_at"]).total_seconds()
    days_ago = seconds_ago / 86400
    recency_decay = math.exp(-math.log(2) * days_ago / _RECENCY_HALF_LIFE_DAYS)
    severity_weight = _SEVERITY_WEIGHT[incident["severity"]]
    source_weight = _SOURCE_WEIGHT[incident["source_tier"]]
    return severity_weight * source_weight * recency_decay


def _cell_self_density(
    cell_id: str,
    incidents_by_cell: dict[str, list[dict]],
    reference_time: datetime,
    lookback_days: int,
) -> float:
    cutoff = reference_time.timestamp() - lookback_days * 86400
    total = 0.0
    for incident in incidents_by_cell.get(cell_id, []):
        if incident["occurred_at"].timestamp() < cutoff:
            continue
        total += _incident_weight(incident, reference_time)
    return total


def compute_cell_features(
    cells: list[dict],
    incidents_by_cell: dict[str, list[dict]],
    patrol_by_cell: dict[str, list[datetime]],
    reference_time: datetime,
    lookback_days: int = 90,
    neighbor_radius: int = 2,
) -> dict[str, dict[str, float]]:
    self_density = {
        cell["cell_id"]: _cell_self_density(
            cell["cell_id"],
            incidents_by_cell,
            reference_time,
            lookback_days,
        )
        for cell in cells
    }

    by_row_col = {(cell["row"], cell["col"]): cell["cell_id"] for cell in cells}

    features: dict[str, dict[str, float]] = {}
    for cell in cells:
        cell_id = cell["cell_id"]

        neighbor_total = 0.0
        for d_row in range(-neighbor_radius, neighbor_radius + 1):
            for d_col in range(-neighbor_radius, neighbor_radius + 1):
                if d_row == 0 and d_col == 0:
                    continue
                neighbor_id = by_row_col.get(
                    (cell["row"] + d_row, cell["col"] + d_col),
                )
                if neighbor_id is not None:
                    neighbor_total += self_density[neighbor_id]

        patrol_times = patrol_by_cell.get(cell_id, [])
        if patrol_times:
            most_recent = max(patrol_times)
            recency_seconds = (reference_time - most_recent).total_seconds()
            recency_days = recency_seconds / 86400
        else:
            recency_days = _NO_PATROL_RECENCY_SENTINEL_DAYS

        features[cell_id] = {
            "incident_density_self": self_density[cell_id],
            "incident_density_neighbors": neighbor_total,
            "patrol_recency_days": recency_days,
            "patrol_frequency": float(len(patrol_times)),
        }

    return features


def build_training_examples(
    cells: list[dict],
    incidents_by_cell: dict[str, list[dict]],
    patrol_by_cell: dict[str, list],
    window_start: datetime,
    window_end: datetime,
    feature_lookback_days: int = 90,
    label_window_days: int = 14,
    step_days: int = 7,
) -> list[dict]:
    examples: list[dict] = []

    reference_time = window_start
    while reference_time <= window_end:
        features_per_cell = compute_cell_features(
            cells,
            incidents_by_cell,
            patrol_by_cell,
            reference_time,
            lookback_days=feature_lookback_days,
        )

        label_end = reference_time + timedelta(days=label_window_days)
        for cell in cells:
            cell_id = cell["cell_id"]
            label = 0
            for incident in incidents_by_cell.get(cell_id, []):
                occurred_at = incident["occurred_at"]
                if reference_time < occurred_at <= label_end:
                    label = 1
                    break

            examples.append(
                {
                    "cell_id": cell_id,
                    "reference_time": reference_time,
                    "features": features_per_cell[cell_id],
                    "label": label,
                },
            )

        reference_time = reference_time + timedelta(days=step_days)

    return examples


def _to_matrix(examples: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    x = np.array(
        [
            [example["features"][name] for name in FEATURE_NAMES]
            for example in examples
        ],
    )
    y = np.array([example["label"] for example in examples])
    return x, y


def train_model(
    examples: list[dict],
    holdout_fraction: float = 0.2,
) -> tuple[bytes, dict]:
    sorted_examples = sorted(examples, key=lambda e: e["reference_time"])
    n_holdout = int(len(sorted_examples) * holdout_fraction)
    n_train = len(sorted_examples) - n_holdout

    train_examples = sorted_examples[:n_train]
    holdout_examples = sorted_examples[n_train:]

    x_train, y_train = _to_matrix(train_examples)
    x_holdout, y_holdout = _to_matrix(holdout_examples)

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        objective="binary:logistic",
        eval_metric="logloss",
    )
    model.fit(x_train, y_train)

    y_pred = model.predict(x_holdout)
    y_proba = model.predict_proba(x_holdout)[:, 1]

    has_both_classes = len(set(y_holdout)) > 1
    auc = float(roc_auc_score(y_holdout, y_proba)) if has_both_classes else 0.5
    metrics = {
        "precision": float(precision_score(y_holdout, y_pred, zero_division=0)),
        "recall": float(recall_score(y_holdout, y_pred, zero_division=0)),
        "auc": auc,
        "n_train": n_train,
        "n_holdout": n_holdout,
    }

    booster = model.get_booster()
    model_bytes = booster.save_raw(raw_format="json")
    return bytes(model_bytes), metrics


def load_model(model_bytes: bytes) -> xgb.Booster:
    booster = xgb.Booster()
    booster.load_model(bytearray(model_bytes))
    return booster


def score_cells(
    model: xgb.Booster,
    features_per_cell: dict[str, dict[str, float]],
) -> dict[str, float]:
    cell_ids = list(features_per_cell.keys())
    x = np.array(
        [
            [features_per_cell[cid][name] for name in FEATURE_NAMES]
            for cid in cell_ids
        ],
    )
    dmatrix = xgb.DMatrix(x, feature_names=FEATURE_NAMES)
    scores = model.predict(dmatrix)
    return {cid: float(score) for cid, score in zip(cell_ids, scores)}
