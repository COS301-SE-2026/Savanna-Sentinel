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
    "sighting_density_self",
    "sighting_density_neighbors",
]

_FEATURE_MONOTONE_SIGNS: dict[str, int] = {
    "incident_density_self": 1,
    "incident_density_neighbors": 1,
    "patrol_recency_days": 1,
    "patrol_frequency": -1,
    "sighting_density_self": 1,
    "sighting_density_neighbors": 1,
}

_SEVERITY_WEIGHT = {"low": 1.0, "medium": 2.0, "high": 3.0, None: 1.0}
_SOURCE_WEIGHT = {"field_report": 1.0, "tipoff": 0.6}
_RECENCY_HALF_LIFE_DAYS = 90.0
_NO_PATROL_RECENCY_SENTINEL_DAYS = 999.0
_NEIGHBOR_WEIGHT_MULTIPLIER = 4.0
_NEIGHBOR_DISTANCE_DECAY = 0.5
_SCALE_POS_WEIGHT_CAP = 50.0

_SIGHTING_RECENCY_HALF_LIFE_DAYS = 3.0
_SIGHTING_LOOKBACK_DAYS = 7

_INCIDENT_FLOOR_BASE = {"low": 0.55, "medium": 0.72, "high": 0.88, None: 0.55}
_INCIDENT_FLOOR_SOURCE_MULT = {"field_report": 1.0, "tipoff": 0.6}
_INCIDENT_FLOOR_HALF_LIFE_DAYS = 30.0
_INCIDENT_FLOOR_LOOKBACK_DAYS = 90
_INCIDENT_FLOOR_RING_MULT = 0.6


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
    reference_ts = reference_time.timestamp()
    cutoff = reference_ts - lookback_days * 86400
    total = 0.0
    for incident in incidents_by_cell.get(cell_id, []):
        occurred_ts = incident["occurred_at"].timestamp()
        if occurred_ts < cutoff or occurred_ts > reference_ts:
            continue
        total += _incident_weight(incident, reference_time)
    return total


def _sighting_weight(sighting: dict, reference_time: datetime) -> float:
    seconds_ago = (reference_time - sighting["occurred_at"]).total_seconds()
    days_ago = seconds_ago / 86400
    recency_decay = math.exp(
        -math.log(2) * days_ago / _SIGHTING_RECENCY_HALF_LIFE_DAYS,
    )
    raw_count = sighting.get("count")
    count = raw_count if raw_count is not None else 1
    herd_boost = 1.0 + math.log1p(max(count - 1, 0))
    return recency_decay * herd_boost


def _cell_self_sighting_density(
    cell_id: str,
    sightings_by_cell: dict[str, list[dict]],
    reference_time: datetime,
    lookback_days: int,
) -> float:
    reference_ts = reference_time.timestamp()
    cutoff = reference_ts - lookback_days * 86400
    total = 0.0
    for sighting in sightings_by_cell.get(cell_id, []):
        occurred_ts = sighting["occurred_at"].timestamp()
        if occurred_ts < cutoff or occurred_ts > reference_ts:
            continue
        total += _sighting_weight(sighting, reference_time)
    return total


def compute_cell_features(
    cells: list[dict],
    incidents_by_cell: dict[str, list[dict]],
    patrol_by_cell: dict[str, list[datetime]],
    reference_time: datetime,
    lookback_days: int = 90,
    neighbor_radius: int = 2,
    sightings_by_cell: dict[str, list[dict]] | None = None,
    sighting_lookback_days: int = _SIGHTING_LOOKBACK_DAYS,
) -> dict[str, dict[str, float]]:
    sightings_by_cell = sightings_by_cell or {}

    self_density = {
        cell["cell_id"]: _cell_self_density(
            cell["cell_id"],
            incidents_by_cell,
            reference_time,
            lookback_days,
        )
        for cell in cells
    }
    self_sighting_density = {
        cell["cell_id"]: _cell_self_sighting_density(
            cell["cell_id"],
            sightings_by_cell,
            reference_time,
            sighting_lookback_days,
        )
        for cell in cells
    }

    by_row_col = {(cell["row"], cell["col"]): cell["cell_id"] for cell in cells}

    features: dict[str, dict[str, float]] = {}
    for cell in cells:
        cell_id = cell["cell_id"]

        neighbor_total = 0.0
        sighting_neighbor_total = 0.0
        for d_row in range(-neighbor_radius, neighbor_radius + 1):
            for d_col in range(-neighbor_radius, neighbor_radius + 1):
                if d_row == 0 and d_col == 0:
                    continue
                neighbor_id = by_row_col.get(
                    (cell["row"] + d_row, cell["col"] + d_col),
                )
                if neighbor_id is not None:
                    distance = max(abs(d_row), abs(d_col))
                    weight = _NEIGHBOR_WEIGHT_MULTIPLIER * (
                        _NEIGHBOR_DISTANCE_DECAY ** (distance - 1)
                    )
                    neighbor_total += weight * self_density[neighbor_id]
                    sighting_neighbor_total += (
                        weight * self_sighting_density[neighbor_id]
                    )

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
            "sighting_density_self": self_sighting_density[cell_id],
            "sighting_density_neighbors": sighting_neighbor_total,
        }

    return features


def compute_incident_floors(
    cells: list[dict],
    incidents_by_cell: dict[str, list[dict]],
    reference_time: datetime,
) -> dict[str, float]:
    by_row_col = {(c["row"], c["col"]): c["cell_id"] for c in cells}
    reference_ts = reference_time.timestamp()
    cutoff = reference_ts - _INCIDENT_FLOOR_LOOKBACK_DAYS * 86400

    floors: dict[str, float] = {}
    for cell in cells:
        best = 0.0
        for d_row in range(-1, 2):
            for d_col in range(-1, 2):
                source_id = by_row_col.get(
                    (cell["row"] + d_row, cell["col"] + d_col),
                )
                if source_id is None:
                    continue
                ring_mult = (
                    1.0
                    if d_row == 0 and d_col == 0
                    else _INCIDENT_FLOOR_RING_MULT
                )
                for incident in incidents_by_cell.get(source_id, []):
                    occurred_ts = incident["occurred_at"].timestamp()
                    if occurred_ts < cutoff or occurred_ts > reference_ts:
                        continue
                    days_ago = (reference_ts - occurred_ts) / 86400
                    decay = math.exp(
                        -math.log(2)
                        * days_ago
                        / _INCIDENT_FLOOR_HALF_LIFE_DAYS,
                    )
                    base = _INCIDENT_FLOOR_BASE[incident["severity"]]
                    source_mult = _INCIDENT_FLOOR_SOURCE_MULT[
                        incident["source_tier"]
                    ]
                    best = max(best, base * decay * source_mult * ring_mult)
        if best > 0.0:
            floors[cell["cell_id"]] = best

    return floors


def build_training_examples(
    cells: list[dict],
    incidents_by_cell: dict[str, list[dict]],
    patrol_by_cell: dict[str, list],
    window_start: datetime,
    window_end: datetime,
    feature_lookback_days: int = 90,
    label_window_days: int = 90,
    step_days: int = 7,
    sightings_by_cell: dict[str, list[dict]] | None = None,
) -> list[dict]:
    examples: list[dict] = []

    last_reference_time = window_end - timedelta(days=label_window_days)

    reference_time = window_start
    while reference_time <= last_reference_time:
        features_per_cell = compute_cell_features(
            cells,
            incidents_by_cell,
            patrol_by_cell,
            reference_time,
            lookback_days=feature_lookback_days,
            sightings_by_cell=sightings_by_cell,
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


def _compute_scale_pos_weight(y_train: np.ndarray) -> float:
    n_positive = int(np.sum(y_train == 1))
    if n_positive == 0:
        return 1.0
    n_negative = int(np.sum(y_train == 0))
    return min(math.sqrt(n_negative / n_positive), _SCALE_POS_WEIGHT_CAP)


def _monotone_constraints() -> tuple[int, ...]:
    return tuple(_FEATURE_MONOTONE_SIGNS[name] for name in FEATURE_NAMES)


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
        scale_pos_weight=_compute_scale_pos_weight(y_train),
        monotone_constraints=_monotone_constraints(),
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
