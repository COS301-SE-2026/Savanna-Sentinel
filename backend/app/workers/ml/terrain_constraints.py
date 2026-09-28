from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

from app.schemas.workspace import MAX_RULE_STRENGTH
from app.workers.terrain.constants import ROUTE_INTENTS
from app.workers.terrain.effects import _project, _to_grid, rule_weight

if TYPE_CHECKING:
    from shapely.geometry.base import BaseGeometry

IMPASSABLE_STRENGTH = MAX_RULE_STRENGTH


@dataclass(frozen=True)
class ImpassableArea:
    feature_id: str
    priority: int
    area: BaseGeometry


@dataclass
class TerrainConstraints:
    areas: list[ImpassableArea] = field(default_factory=list)
    top_priority: dict[str, int] = field(default_factory=dict)
    epsg: int = 0

    def overridden(self, area: ImpassableArea, cell_ref: str) -> bool:
        return self.top_priority.get(cell_ref, 0) > area.priority

    def to_grid(self, point: tuple[float, float]) -> tuple[float, float]:
        return _to_grid(self.epsg).transform(*point)

    def blocks_point(
        self,
        xy: tuple[float, float],
        cell_ref: str | None,
    ) -> bool:
        spot = Point(xy)
        return any(
            area.area.intersects(spot)
            and not (cell_ref and self.overridden(area, cell_ref))
            for area in self.areas
        )

    def blocks_segment(
        self,
        start_xy: tuple[float, float],
        end_xy: tuple[float, float],
        cell_ref: str,
    ) -> bool:
        segment = LineString([start_xy, end_xy])
        start = Point(start_xy)
        return any(
            area.area.intersects(segment)
            and not area.area.intersects(start)
            and not self.overridden(area, cell_ref)
            for area in self.areas
        )


def impassable_areas(
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
    epsg: int,
) -> list[ImpassableArea]:
    areas = []
    for feature in features:
        avoid = resolved.get(feature["id"], {}).get("avoid")
        if avoid is None or avoid["strength"] < IMPASSABLE_STRENGTH:
            continue
        area = _project(feature["geometry"], epsg)
        
        if feature["buffer_enabled"] and avoid["buffer_decay"] == 0:
            area = area.buffer(feature["buffer_distance_m"])
        areas.append(ImpassableArea(feature["id"], avoid["priority"], area))
    return areas


def top_priority_by_cell(
    cells: list[tuple[str, BaseGeometry]],
    epsg: int,
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
) -> dict[str, int]:
    if not cells or not resolved:
        return {}

    polygons = [polygon for _, polygon in cells]
    tree = STRtree(polygons)
    top: dict[str, int] = {}

    for feature in features:
        rules = {
            intent: rule
            for intent, rule in resolved.get(feature["id"], {}).items()
            if intent in ROUTE_INTENTS
        }
        if not rules:
            continue

        footprint = _project(feature["geometry"], epsg)
        distance = feature["buffer_distance_m"]
        buffer_area = (
            footprint.buffer(distance) if feature["buffer_enabled"] else None
        )
        reach_area = buffer_area if buffer_area is not None else footprint

        for index in tree.query(reach_area, predicate="intersects"):
            ref, cell = cells[int(index)]
            for rule in rules.values():
                weight = rule_weight(
                    cell,
                    footprint,
                    buffer_area,
                    distance,
                    rule,
                )
                if weight > 0.0 and rule["priority"] > top.get(ref, 0):
                    top[ref] = rule["priority"]
    return top


def build_constraints(
    cells: list[tuple[str, BaseGeometry]],
    epsg: int,
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
) -> TerrainConstraints:
    areas = impassable_areas(features, resolved, epsg)
    if not areas:
        return TerrainConstraints(epsg=epsg)
    return TerrainConstraints(
        areas=areas,
        top_priority=top_priority_by_cell(cells, epsg, features, resolved),
        epsg=epsg,
    )
