import numpy as np
import shap
import xgboost as xgb

from app.workers.ml.risk_engine import FEATURE_NAMES


def explain_cells(
    model: xgb.Booster,
    features_per_cell: dict[str, dict[str, float]],
    top_n: int = 3,
) -> dict[str, list[tuple[str, float]]]:
    cell_ids = list(features_per_cell.keys())
    x = np.array(
        [
            [features_per_cell[cid][name] for name in FEATURE_NAMES]
            for cid in cell_ids
        ],
    )

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(x)

    result: dict[str, list[tuple[str, float]]] = {}
    for row_idx, cell_id in enumerate(cell_ids):
        row_values = shap_values[row_idx]
        abs_total = sum(abs(v) for v in row_values)
        if abs_total == 0:
            normalized = [0.0 for _ in row_values]
        else:
            normalized = [abs(v) / abs_total for v in row_values]

        ranked = sorted(
            zip(FEATURE_NAMES, normalized),
            key=lambda pair: pair[1],
            reverse=True,
        )
        result[cell_id] = ranked[:top_n]

    return result
