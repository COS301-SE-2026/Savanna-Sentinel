import json
import math
from functools import lru_cache
from pathlib import Path

from pyproj import Transformer

from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph

# Placeholder patrol-vehicle profile - no vehicle telemetry/risk engine exists
# yet to derive these from, so a flat off-road estimate is used for every edge.
AVG_SPEED_KMH = 20.0
FUEL_L_PER_KM = 0.15

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Maps a park_id to its pre-generated grid file. Only one park is available
# today; add entries here as more parks get their own grid exports.
_PARK_GRID_FILES = {
    "klaserie": _DATA_DIR / "klaserie_grid.geojson",
}


@lru_cache(maxsize=None)
def _load_grid(park_id: str) -> ParkGraph:
    grid_path = _PARK_GRID_FILES.get(park_id)
    if grid_path is None:
        raise ValueError(f"No grid data available for park_id={park_id!r}")

    with open(grid_path) as f:
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
                        est_fuel_l=km * FUEL_L_PER_KM,
                    ),
                )

    return ParkGraph(park_id=park_id, nodes=nodes, edges=edges)


def build_park_graph(
    park_id: str,
    risk_by_cell: dict[str, float] | None = None,
) -> ParkGraph:
    """Assemble ParkGraph from park_id's grid, with risk scores applied.

    _load_grid's result is lru_cache'd and shared across every caller, so
    its nodes are never mutated here. A fresh GraphNode list is built on
    every call instead, keeping the expensive file read/reprojection cached
    while risk injection stays request-scoped. A cell_id absent from
    risk_by_cell (or no risk_by_cell at all) gets a neutral 0.0.
    """
    risk_by_cell = risk_by_cell or {}
    base = _load_grid(park_id)
    nodes = [
        GraphNode(
            node_id=n.node_id,
            location=n.location,
            risk_score=risk_by_cell.get(n.node_id, 0.0),
        )
        for n in base.nodes
    ]
    return ParkGraph(park_id=base.park_id, nodes=nodes, edges=base.edges)


def find_nearest_node(graph: ParkGraph, point: tuple[float, float]) -> str:
    """Nearest grid node to a (lon, lat) point, by simple squared distance."""
    lon, lat = point
    return min(
        graph.nodes,
        key=lambda n: (
            (n.location.coordinates[0] - lon) ** 2
            + (n.location.coordinates[1] - lat) ** 2
        ),
    ).node_id
