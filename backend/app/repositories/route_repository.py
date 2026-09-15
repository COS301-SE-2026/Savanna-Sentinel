import json
import math
from functools import lru_cache

from pyproj import Transformer

from app.repositories.risk_repository import GRID_FILE_PATH
from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph
from app.workers.ml.route_planner import clear_path_cache

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


def build_park_graph(
    park_id: str,
    risk_by_cell: dict[str, float] | None = None,
) -> ParkGraph:
    """Assemble ParkGraph from the park's grid, with risk scores applied.

    _load_grid's result is lru_cache'd and shared across every caller, so
    its nodes are never mutated here. A fresh GraphNode list is built on
    every call instead, keeping the expensive file read/reprojection cached
    while risk injection stays request-scoped. A cell_id absent from
    risk_by_cell (or no risk_by_cell at all) gets a neutral 0.0.
    """
    risk_by_cell = risk_by_cell or {}
    base = _load_grid()
    nodes = [
        GraphNode(
            node_id=n.node_id,
            location=n.location,
            risk_score=risk_by_cell.get(n.node_id, 0.0),
        )
        for n in base.nodes
    ]
    return ParkGraph(park_id=park_id, nodes=nodes, edges=base.edges)


KM_PER_DEGREE = 111.0
MAX_SNAP_CELLS = 1.5


def _squared_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon_scale = math.cos(math.radians(b[1]))
    d_lon = (a[0] - b[0]) * lon_scale * KM_PER_DEGREE
    d_lat = (a[1] - b[1]) * KM_PER_DEGREE
    return d_lon**2 + d_lat**2


def find_nearest_node(graph: ParkGraph, point: tuple[float, float]) -> str:
    if not graph.nodes:
        raise ValueError("Park grid has no cells")
    nearest = min(
        graph.nodes,
        key=lambda n: _squared_km(n.location.coordinates, point),
    )
    cell_km = min((e.distance_km for e in graph.edges), default=1.0)
    limit = MAX_SNAP_CELLS * cell_km
    if _squared_km(nearest.location.coordinates, point) > limit**2:
        raise ValueError(
            f"Point {point} is more than {limit:.1f} km outside the park grid",
        )
    return nearest.node_id
