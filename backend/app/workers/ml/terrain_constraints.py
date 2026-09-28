from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import TYPE_CHECKING, Any

from pyproj import Transformer
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points
from shapely.strtree import STRtree

from app.schemas.workspace import MAX_RULE_STRENGTH
from app.workers.terrain.constants import ROUTE_INTENTS
from app.workers.terrain.effects import _project, _to_grid, rule_weight

if TYPE_CHECKING:
    from shapely.geometry.base import BaseGeometry

IMPASSABLE_STRENGTH = MAX_RULE_STRENGTH
GATE_REACH_CELLS = 0.5
GATE_SNAP_M = 1.0
_LINEAR = ("LineString", "MultiLineString")


@lru_cache(maxsize=None)
def _from_grid(epsg: int) -> Transformer:
    return Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)


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
    gates: dict[str, list[BaseGeometry]] = field(default_factory=dict)
    gate_reach_m: float = 0.0

    def overridden(self, area: ImpassableArea, cell_ref: str) -> bool:
        return self.top_priority.get(cell_ref, 0) > area.priority

    def to_grid(self, point: tuple[float, float]) -> tuple[float, float]:
        return _to_grid(self.epsg).transform(*point)

    def from_grid(self, xy: tuple[float, float]) -> tuple[float, float]:
        return _from_grid(self.epsg).transform(*xy)

    def _via(
        self,
        area: ImpassableArea,
        segment: LineString,
    ) -> Point | None:
        gates = self.gates.get(area.feature_id)
        if not gates:
            return None
        gate = min(gates, key=segment.distance)
        if segment.distance(gate) > self.gate_reach_m:
            return None
        if area.area.geom_type in _LINEAR:
            return nearest_points(area.area, gate)[0]
        return nearest_points(gate, segment)[0]

    def opens(self, area: ImpassableArea, segment: LineString) -> bool:
        """Whether a move may cross the area through one of its gates.

        For a line barrier the move, drawn through the gate, must meet the
        barrier only at the gate, so a bend nearby can't be crossed instead.
        """
        via = self._via(area, segment)
        if via is None:
            return False
        if area.area.geom_type not in _LINEAR:
            return True
        start, end = segment.coords[0], segment.coords[-1]
        legs = LineString([start, (via.x, via.y), end])
        hit = legs.intersection(area.area)
        return hit.is_empty or hit.within(via.buffer(GATE_SNAP_M))

    def crossing_vias(
        self,
        start_xy: tuple[float, float],
        end_xy: tuple[float, float],
    ) -> list[tuple[float, float]]:
        """Gate point for each barrier the move start->end crosses."""
        segment = LineString([start_xy, end_xy])
        vias = []
        for area in self.areas:
            if not area.area.intersects(segment):
                continue
            via = self._via(area, segment)
            if via is not None:
                vias.append((segment.project(via), (via.x, via.y)))
        return [xy for _, xy in sorted(vias)]

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


def _route_priority(rules: dict[str, dict[str, Any]]) -> int | None:
    priorities = [
        rule["priority"]
        for intent, rule in rules.items()
        if intent in ROUTE_INTENTS
    ]
    return max(priorities, default=None)


def crossing_gates(
    areas: list[ImpassableArea],
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
    epsg: int,
    reach_m: float,
) -> dict[str, list[BaseGeometry]]:
    """Parts of higher-priority features near each impassable area."""
    crossings = []
    for feature in features:
        priority = _route_priority(resolved.get(feature["id"], {}))
        if priority is not None:
            footprint = _project(feature["geometry"], epsg)
            crossings.append((feature["id"], priority, footprint))

    gates: dict[str, list[BaseGeometry]] = {}
    for area in areas:
        zone = area.area.buffer(reach_m)
        for feature_id, priority, footprint in crossings:
            if feature_id == area.feature_id or priority <= area.priority:
                continue
            gate = footprint.intersection(zone)
            if not gate.is_empty:
                gates.setdefault(area.feature_id, []).append(gate)
    return gates


def build_constraints(
    cells: list[tuple[str, BaseGeometry]],
    epsg: int,
    features: list[dict[str, Any]],
    resolved: dict[str, dict[str, dict[str, Any]]],
) -> TerrainConstraints:
    areas = impassable_areas(features, resolved, epsg)
    if not areas:
        return TerrainConstraints(epsg=epsg)
    minx, _, maxx, _ = cells[0][1].bounds if cells else (0, 0, 0, 0)
    reach_m = (maxx - minx) * GATE_REACH_CELLS
    return TerrainConstraints(
        areas=areas,
        top_priority=top_priority_by_cell(cells, epsg, features, resolved),
        epsg=epsg,
        gates=crossing_gates(areas, features, resolved, epsg, reach_m),
        gate_reach_m=reach_m,
    )
