from __future__ import annotations

import hashlib
import json
from typing import Any


def rules_projection_hash(
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
) -> str:
    projection = []
    for feature in sorted(features, key=lambda f: f["id"]):
        rules = resolved.get(feature["id"])
        if not rules:
            continue
        projection.append(
            {
                "id": feature["id"],
                "geometry": feature["geometry"],
                "buffer_distance_m": (
                    feature["buffer_distance_m"]
                    if feature["buffer_enabled"]
                    else None
                ),
                "rules": rules,
            },
        )
    payload = json.dumps(projection, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


EMPTY_HASH = rules_projection_hash([], {})
