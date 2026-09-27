from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING, Any

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform
from shapely.strtree import STRtree

from app.workers.terrain.constants import (
    AVOID_MAX,
    MAX_RISK_DELTA,
    MIN_WEIGHT,
    NEUTRAL_EPSILON,
    PREFER_MIN,
    RISK_INTENTS,
    ROUTE_INTENTS,
    ROUTE_MULT_MAX,
    ROUTE_MULT_MIN,
)

if TYPE_CHECKING:
    from shapely.geometry.base import BaseGeometry


@dataclass(frozen=True)
class RuleReach:
    intent: str
    priority: int
    weight: float


@lru_cache(maxsize=None)
def _to_grid(epsg: int) -> Transformer:
    return Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)


def _project(geojson: dict[str, Any], epsg: int) -> BaseGeometry:
    return transform(_to_grid(epsg).transform, shape(geojson))


def rule_weight(
    cell: BaseGeometry,
    footprint: BaseGeometry,
    buffer_area: BaseGeometry | None,
    buffer_distance_m: float,
    rule: dict[str, Any],
) -> float:
    if cell.intersects(footprint):
        fraction = 1.0
    elif buffer_area is not None and cell.intersects(buffer_area):
        distance = cell.distance(footprint)
        fraction = 1.0 - rule["buffer_decay"] * min(
            distance / buffer_distance_m,
            1.0,
        )
    else:
        return 0.0

    weight = rule["strength"] * fraction
    return weight if weight >= MIN_WEIGHT else 0.0


def _top_priority(reaches: list[RuleReach]) -> list[RuleReach]:
    if not reaches:
        return []
    top = max(reach.priority for reach in reaches)
    return [reach for reach in reaches if reach.priority == top]


def _combine_risk(reaches: list[RuleReach]) -> float:
    delta = sum(
        (1 if reach.intent == "increase_risk" else -1)
        * MAX_RISK_DELTA
        * reach.weight
        for reach in _top_priority(reaches)
    )
    return max(-1.0, min(1.0, delta))


def _combine_route(reaches: list[RuleReach]) -> float:
    multiplier = 1.0
    for reach in _top_priority(reaches):
        if reach.intent == "avoid":
            multiplier *= 1.0 + (AVOID_MAX - 1.0) * reach.weight
        else:
            multiplier *= 1.0 - (1.0 - PREFER_MIN) * reach.weight
    return max(ROUTE_MULT_MIN, min(ROUTE_MULT_MAX, multiplier))


def combine_cell(reaches: list[RuleReach]) -> dict[str, float] | None:
    risk_delta = _combine_risk(
        [r for r in reaches if r.intent in RISK_INTENTS],
    )
    route_multiplier = _combine_route(
        [r for r in reaches if r.intent in ROUTE_INTENTS],
    )
    if (
        abs(risk_delta) < NEUTRAL_EPSILON
        and abs(route_multiplier - 1.0) < NEUTRAL_EPSILON
    ):
        return None
    return {"risk_delta": risk_delta, "route_multiplier": route_multiplier}


def compute_cell_effects(
    cells: list[tuple[str, BaseGeometry]],
    epsg: int,
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
) -> dict[str, dict[str, float]]:
    if not cells or not resolved:
        return {}

    polygons = [polygon for _, polygon in cells]
    tree = STRtree(polygons)
    reaches_by_cell: dict[int, list[RuleReach]] = {}

    for feature in features:
        rules = resolved.get(feature["id"])
        if not rules:
            continue

        footprint = _project(feature["geometry"], epsg)
        distance = feature["buffer_distance_m"]
        buffer_area = (
            footprint.buffer(distance) if feature["buffer_enabled"] else None
        )
        reach_area = buffer_area if buffer_area is not None else footprint

        for index in tree.query(reach_area, predicate="intersects"):
            cell = polygons[int(index)]
            for intent, rule in rules.items():
                weight = rule_weight(
                    cell,
                    footprint,
                    buffer_area,
                    distance,
                    rule,
                )
                if weight > 0.0:
                    reaches_by_cell.setdefault(int(index), []).append(
                        RuleReach(intent, rule["priority"], weight),
                    )

    effects: dict[str, dict[str, float]] = {}
    for index, reaches in reaches_by_cell.items():
        combined = combine_cell(reaches)
        if combined is not None:
            effects[cells[index][0]] = combined
    return effects
