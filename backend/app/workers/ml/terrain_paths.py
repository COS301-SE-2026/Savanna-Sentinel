from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from app.workers.ml.terrain_constraints import _from_grid
from app.workers.terrain.constants import PREFER_MIN, ROUTE_INTENTS
from app.workers.terrain.effects import _project

MAX_PATH_STEP_M = 250.0

Vertex = tuple[tuple[float, float], tuple[float, float]]


@dataclass(frozen=True)
class FollowLine:
    """A preferred line routes can drive along, as (grid xy, lon/lat) runs."""

    feature_id: str
    multiplier: float
    parts: tuple[tuple[Vertex, ...], ...]


def _densify(
    coords: list[tuple[float, float]],
    step_m: float,
) -> list[tuple[float, float]]:
    points = [coords[0]]
    for a, b in zip(coords, coords[1:]):
        steps = max(1, math.ceil(math.dist(a, b) / step_m))
        points.extend(
            (
                a[0] + (b[0] - a[0]) * k / steps,
                a[1] + (b[1] - a[1]) * k / steps,
            )
            for k in range(1, steps + 1)
        )
    return points


def followable_lines(
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
    epsg: int,
    step_m: float = MAX_PATH_STEP_M,
) -> list[FollowLine]:
    """Lines whose highest-priority route rule is a prefer rule."""
    to_lonlat = _from_grid(epsg)
    lines = []
    for feature in features:
        rules = {
            intent: rule
            for intent, rule in resolved.get(feature["id"], {}).items()
            if intent in ROUTE_INTENTS
        }
        prefer = rules.get("prefer")
        if prefer is None:
            continue
        if any(r["priority"] > prefer["priority"] for r in rules.values()):
            continue

        geometry = _project(feature["geometry"], epsg)
        if geometry.geom_type == "LineString":
            pieces = [geometry]
        elif geometry.geom_type == "MultiLineString":
            pieces = list(geometry.geoms)
        else:
            continue

        parts = tuple(
            tuple(
                (xy, to_lonlat.transform(*xy))
                for xy in _densify(list(piece.coords), step_m)
            )
            for piece in pieces
        )
        multiplier = 1.0 - (1.0 - PREFER_MIN) * prefer["strength"]
        lines.append(FollowLine(feature["id"], multiplier, parts))
    return lines
