import json
import math
from functools import lru_cache
from typing import TYPE_CHECKING

from pyproj import Transformer
from shapely.geometry import LineString, Point
from shapely.prepared import prep

from app.repositories.risk_repository import GRID_FILE_PATH
from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph
from app.workers.ml.route_planner import clear_path_cache

if TYPE_CHECKING:
    from app.workers.ml.terrain_constraints import TerrainConstraints

# Placeholder patrol-vehicle profile - no vehicle telemetry/risk engine exists
# yet to derive this from, so a flat off-road estimate is used for every edge.
AVG_SPEED_KMH = 20.0


@lru_cache(maxsize=None)
def _load_grid() -> ParkGraph:
    if not GRID_FILE_PATH.is_file():
        raise FileNotFoundError("No park grid has been uploaded yet")

    with open(GRID_FILE_PATH) as f:
        geojson = json.load(f)

    epsg_code = geojson["crs"]["properties"]["name"].rsplit(":", 1)[-1]
    to_wgs84 = Transformer.from_crs(
        f"EPSG:{epsg_code}",
        "EPSG:4326",
        always_xy=True,
    )

    cells = {}
    for feature in geojson["features"]:
        props = feature["properties"]
        cell_id = int(props["id"])
        center_x = (props["left"] + props["right"]) / 2
        center_y = (props["top"] + props["bottom"]) / 2
        lon, lat = to_wgs84.transform(center_x, center_y)
        cells[cell_id] = {
            "row": int(props["row_index"]),
            "col": int(props["col_index"]),
            "lon": lon,
            "lat": lat,
            "xy": (center_x, center_y),
        }

    cell_width_m = (
        geojson["features"][0]["properties"]["right"]
        - geojson["features"][0]["properties"]["left"]
    )
    distance_km = cell_width_m / 1000
    diagonal_km = distance_km * math.sqrt(2)

    nodes = [
        GraphNode(
            node_id=f"cell-{cell_id}",
            location=GeoPoint(coordinates=(cell["lon"], cell["lat"])),
            # No computed risk heatmap exists yet - neutral placeholder
            # until the risk engine is wired in.
            risk_score=0.0,
            grid_xy=cell["xy"],
        )
        for cell_id, cell in cells.items()
    ]

    by_row_col = {
        (cell["row"], cell["col"]): cell_id for cell_id, cell in cells.items()
    }
    orthogonal_offsets = ((1, 0), (-1, 0), (0, 1), (0, -1))
    diagonal_offsets = ((1, 1), (1, -1), (-1, 1), (-1, -1))
    edges = []
    for cell_id, cell in cells.items():
        for offsets, km in (
            (orthogonal_offsets, distance_km),
            (diagonal_offsets, diagonal_km),
        ):
            for d_row, d_col in offsets:
                neighbor_id = by_row_col.get(
                    (cell["row"] + d_row, cell["col"] + d_col),
                )
                if neighbor_id is None:
                    continue
                edges.append(
                    GraphEdge(
                        from_node_id=f"cell-{cell_id}",
                        to_node_id=f"cell-{neighbor_id}",
                        distance_km=km,
                        est_time_min=km / AVG_SPEED_KMH * 60,
                    ),
                )

    # _load_grid has no park_id (only one grid file),
    # build_park_graph stamps the real one onto its returned copy.
    return ParkGraph(park_id="", nodes=nodes, edges=edges)


def invalidate_grid_cache() -> None:
    _load_grid.cache_clear()
    clear_path_cache()


def _blocked_by_terrain(
    base: ParkGraph,
    constraints: "TerrainConstraints | None",
) -> tuple[set[str], set[frozenset[str]]]:
    """Cells and moves an impassable area rules out.

    A cell goes when its centre is inside the area, a move when the line
    between the two centres crosses it. A cell a higher-priority rule
    reaches (a bridge) is exempt, as is any move touching such a cell.
    """
    if constraints is None or not constraints.areas:
        return set(), set()

    areas = [(area, prep(area.area)) for area in constraints.areas]
    centres = {n.node_id: n.grid_xy for n in base.nodes}

    blocked_nodes = {
        node_id
        for node_id, xy in centres.items()
        if any(
            prepared.contains(Point(xy))
            and not constraints.overridden(area, node_id)
            for area, prepared in areas
        )
    }

    blocked_edges: set[frozenset[str]] = set()
    seen: set[frozenset[str]] = set()
    for edge in base.edges:
        a, b = edge.from_node_id, edge.to_node_id
        pair = frozenset((a, b))
        if pair in seen:
            continue
        seen.add(pair)
        segment = LineString([centres[a], centres[b]])
        if any(
            prepared.intersects(segment)
            and not constraints.overridden(area, a)
            and not constraints.overridden(area, b)
            for area, prepared in areas
        ):
            blocked_edges.add(pair)
    return blocked_nodes, blocked_edges


def _with_cost(edge: GraphEdge, costs: dict[str, float]) -> GraphEdge:
    factor = (
        costs.get(edge.from_node_id, 1.0) + costs.get(edge.to_node_id, 1.0)
    ) / 2
    if factor == 1.0:
        return edge
    return GraphEdge(
        from_node_id=edge.from_node_id,
        to_node_id=edge.to_node_id,
        distance_km=edge.distance_km,
        est_time_min=edge.est_time_min * factor,
    )


def build_park_graph(
    park_id: str,
    risk_by_cell: dict[str, float] | None = None,
    route_cost_by_cell: dict[str, float] | None = None,
    constraints: "TerrainConstraints | None" = None,
    terrain_key: str = "",
) -> ParkGraph:
    """Assemble ParkGraph from the park's grid, with risk and terrain applied.

    _load_grid's result is lru_cache'd and shared across every caller, so
    its nodes are never mutated here. A fresh GraphNode list is built on
    every call instead, keeping the expensive file read/reprojection cached
    while risk injection stays request-scoped. A cell_id absent from
    risk_by_cell (or no risk_by_cell at all) gets a neutral 0.0.

    Terrain multipliers scale est_time_min only, distance_km stays real.
    """
    risk_by_cell = risk_by_cell or {}
    costs = route_cost_by_cell or {}
    base = _load_grid()
    blocked_nodes, blocked_edges = _blocked_by_terrain(base, constraints)

    nodes = [
        GraphNode(
            node_id=n.node_id,
            location=n.location,
            risk_score=risk_by_cell.get(n.node_id, 0.0),
            grid_xy=n.grid_xy,
        )
        for n in base.nodes
        if n.node_id not in blocked_nodes
    ]
    neighbor_edges = [
        e
        for e in base.edges
        if e.from_node_id not in blocked_nodes
        and e.to_node_id not in blocked_nodes
    ]
    edges = [
        _with_cost(e, costs)
        for e in neighbor_edges
        if frozenset((e.from_node_id, e.to_node_id)) not in blocked_edges
    ]
    return ParkGraph(
        park_id=park_id,
        nodes=nodes,
        edges=edges,
        neighbor_edges=neighbor_edges,
        terrain_key=terrain_key,
        constraints=constraints,
    )


KM_PER_DEGREE = 111.0
MAX_SNAP_CELLS = 1.5


def _squared_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon_scale = math.cos(math.radians(b[1]))
    d_lon = (a[0] - b[0]) * lon_scale * KM_PER_DEGREE
    d_lat = (a[1] - b[1]) * KM_PER_DEGREE
    return d_lon**2 + d_lat**2


def find_nearest_node(
    graph: ParkGraph,
    point: tuple[float, float],
    constraints: "TerrainConstraints | None" = None,
) -> str:
    """Closest cell to point, skipping any only reachable across a barrier."""
    if not graph.nodes:
        raise ValueError("Park grid has no cells")

    def distance(node: GraphNode) -> float:
        return _squared_km(node.location.coordinates, point)

    nearest = min(graph.nodes, key=distance)
    cell_km = min((e.distance_km for e in graph.edges), default=1.0)
    limit = MAX_SNAP_CELLS * cell_km
    if distance(nearest) > limit**2:
        raise ValueError(
            f"Point {point} is more than {limit:.1f} km outside the park grid",
        )
    if constraints is None or not constraints.areas:
        return nearest.node_id

    xy = constraints.to_grid(point)
    for node in sorted(graph.nodes, key=distance):
        if distance(node) > limit**2:
            break
        if not constraints.blocks_segment(xy, node.grid_xy, node.node_id):
            return node.node_id
    raise ValueError(
        f"Point {point} can only reach the grid across an impassable area",
    )
