import json

import pytest
from pyproj import Transformer

from app.repositories import route_repository
from app.repositories.route_repository import (
    AVG_SPEED_KMH,
    FUEL_L_PER_KM,
    build_park_graph,
    find_nearest_node,
)
from app.schemas.geo import GeoPoint
from app.schemas.route import GraphNode, ParkGraph

_EPSG = 32736
_CELL_M = 1000.0
_BASE_LEFT = 317527.85260646814
_BASE_TOP = 7315330.772710353


def _cell(cell_id, row, col):
    left = _BASE_LEFT + col * _CELL_M
    top = _BASE_TOP - row * _CELL_M
    return {
        "type": "Feature",
        "properties": {
            "id": float(cell_id),
            "left": left,
            "top": top,
            "right": left + _CELL_M,
            "bottom": top - _CELL_M,
            "row_index": float(row),
            "col_index": float(col),
        },
    }


def _write_grid(tmp_path, cells):
    geojson = {
        "type": "FeatureCollection",
        "name": "test_grid",
        "crs": {
            "type": "name",
            "properties": {"name": f"urn:ogc:def:crs:EPSG::{_EPSG}"},
        },
        "features": cells,
    }
    path = tmp_path / "grid.geojson"
    path.write_text(json.dumps(geojson))
    return path


@pytest.fixture
def grid_2x2(tmp_path, monkeypatch):
    """Return a 2x2 grid: cell ids 1-4 at row/col 0/1, fully 4-connected."""
    cells = [
        _cell(1, row=0, col=0),
        _cell(2, row=0, col=1),
        _cell(3, row=1, col=0),
        _cell(4, row=1, col=1),
    ]
    path = _write_grid(tmp_path, cells)
    park_id = "unit-test-2x2"
    monkeypatch.setitem(route_repository._PARK_GRID_FILES, park_id, path)
    route_repository._load_grid.cache_clear()
    yield park_id
    route_repository._load_grid.cache_clear()


# _load_grid


def test_load_grid_builds_one_node_per_feature(grid_2x2):
    graph = route_repository._load_grid(grid_2x2)
    assert len(graph.nodes) == 4
    assert {n.node_id for n in graph.nodes} == {
        "cell-1",
        "cell-2",
        "cell-3",
        "cell-4",
    }


def test_load_grid_converts_projected_coords_to_lon_lat(grid_2x2):
    """Reproduce the transform independently and compare exact output."""
    graph = route_repository._load_grid(grid_2x2)
    to_wgs84 = Transformer.from_crs(
        f"EPSG:{_EPSG}",
        "EPSG:4326",
        always_xy=True,
    )

    node = next(n for n in graph.nodes if n.node_id == "cell-1")
    center_x = _BASE_LEFT + _CELL_M / 2
    center_y = _BASE_TOP - _CELL_M / 2
    expected_lon, expected_lat = to_wgs84.transform(center_x, center_y)

    assert node.location.coordinates[0] == pytest.approx(expected_lon)
    assert node.location.coordinates[1] == pytest.approx(expected_lat)


def test_load_grid_nodes_have_neutral_risk_score(grid_2x2):
    """No risk heatmap exists yet - every node must be a neutral 0.0."""
    graph = route_repository._load_grid(grid_2x2)
    assert all(n.risk_score == 0.0 for n in graph.nodes)


def test_load_grid_builds_8_connected_edges_with_diagonals(grid_2x2):
    """4 connected orthogonal neighbours plus both diagonal pairs.

    Diagonal edges let a route angle directly toward its target.
    """
    graph = route_repository._load_grid(grid_2x2)
    pairs = {(e.from_node_id, e.to_node_id) for e in graph.edges}

    assert pairs == {
        ("cell-1", "cell-2"),
        ("cell-2", "cell-1"),
        ("cell-1", "cell-3"),
        ("cell-3", "cell-1"),
        ("cell-2", "cell-4"),
        ("cell-4", "cell-2"),
        ("cell-3", "cell-4"),
        ("cell-4", "cell-3"),
        ("cell-1", "cell-4"),
        ("cell-4", "cell-1"),
        ("cell-2", "cell-3"),
        ("cell-3", "cell-2"),
    }


def test_load_grid_edge_costs_derived_from_cell_width(grid_2x2):
    graph = route_repository._load_grid(grid_2x2)
    distance_km = _CELL_M / 1000
    diagonal_km = distance_km * (2**0.5)

    orthogonal_pairs = {
        ("cell-1", "cell-2"),
        ("cell-2", "cell-1"),
        ("cell-1", "cell-3"),
        ("cell-3", "cell-1"),
        ("cell-2", "cell-4"),
        ("cell-4", "cell-2"),
        ("cell-3", "cell-4"),
        ("cell-4", "cell-3"),
    }

    assert len(graph.edges) == 12
    for edge in graph.edges:
        pair = (edge.from_node_id, edge.to_node_id)
        expected_km = distance_km if pair in orthogonal_pairs else diagonal_km
        assert edge.distance_km == pytest.approx(expected_km)
        assert edge.est_time_min == pytest.approx(
            expected_km / AVG_SPEED_KMH * 60,
        )
        assert edge.est_fuel_l == pytest.approx(expected_km * FUEL_L_PER_KM)


def test_load_grid_unknown_park_id_raises_value_error():
    with pytest.raises(ValueError, match="unknown-park"):
        route_repository._load_grid("unknown-park")


def test_load_grid_is_cached_across_calls(grid_2x2):
    """@lru_cache means repeated calls for the same park_id are free."""
    first = route_repository._load_grid(grid_2x2)
    second = route_repository._load_grid(grid_2x2)
    assert first is second


# build_park_graph


def test_build_park_graph_delegates_to_load_grid(grid_2x2):
    graph = build_park_graph(grid_2x2)
    assert isinstance(graph, ParkGraph)
    assert graph.park_id == grid_2x2
    assert len(graph.nodes) == 4


def test_build_park_graph_defaults_to_neutral_risk_when_no_data_supplied(
    grid_2x2,
):
    graph = build_park_graph(grid_2x2)
    assert all(n.risk_score == 0.0 for n in graph.nodes)


def test_build_park_graph_injects_supplied_risk_scores(grid_2x2):
    graph = build_park_graph(
        grid_2x2,
        risk_by_cell={"cell-1": 0.7, "cell-2": 0.3},
    )
    scores = {n.node_id: n.risk_score for n in graph.nodes}
    assert scores == {
        "cell-1": 0.7,
        "cell-2": 0.3,
        "cell-3": 0.0,
        "cell-4": 0.0,
    }


def test_build_park_graph_does_not_mutate_cached_load_grid_result(grid_2x2):
    """The lru_cache'd graph from _load_grid must stay neutral across calls.

    Regression guard: if risk injection ever mutated the cached nodes in
    place, one request's risk data would leak into every other request for
    the same park_id, including ones that didnt supply risk data
    """
    build_park_graph(grid_2x2, risk_by_cell={"cell-1": 0.9})
    cached = route_repository._load_grid(grid_2x2)
    assert all(n.risk_score == 0.0 for n in cached.nodes)


def test_build_park_graph_calls_are_isolated_from_each_other(grid_2x2):
    first = build_park_graph(grid_2x2, risk_by_cell={"cell-1": 0.9})
    second = build_park_graph(grid_2x2, risk_by_cell={"cell-1": 0.1})
    first_score = next(
        n.risk_score for n in first.nodes if n.node_id == "cell-1"
    )
    second_score = next(
        n.risk_score for n in second.nodes if n.node_id == "cell-1"
    )
    assert first_score == 0.9
    assert second_score == 0.1


# find_nearest_node


def test_find_nearest_node_returns_closest_node():
    graph = ParkGraph(
        park_id="p",
        nodes=[
            GraphNode(
                node_id="a",
                location=GeoPoint(coordinates=(0.0, 0.0)),
                risk_score=0.0,
            ),
            GraphNode(
                node_id="b",
                location=GeoPoint(coordinates=(10.0, 10.0)),
                risk_score=0.0,
            ),
            GraphNode(
                node_id="c",
                location=GeoPoint(coordinates=(9.5, 9.5)),
                risk_score=0.0,
            ),
        ],
        edges=[],
    )
    assert find_nearest_node(graph, (9.9, 9.9)) == "b"
    assert find_nearest_node(graph, (0.1, -0.1)) == "a"


def test_find_nearest_node_exact_match_returns_same_node():
    graph = ParkGraph(
        park_id="p",
        nodes=[
            GraphNode(
                node_id="only",
                location=GeoPoint(coordinates=(5.0, 5.0)),
                risk_score=0.0,
            ),
        ],
        edges=[],
    )
    assert find_nearest_node(graph, (5.0, 5.0)) == "only"


# Sanity checks against the real production grid file


def test_klaserie_grid_loads_full_graph():
    graph = build_park_graph("klaserie")
    assert graph.park_id == "klaserie"
    assert len(graph.nodes) == 684


def test_klaserie_grid_edges_are_symmetric():
    graph = build_park_graph("klaserie")
    pairs = {(e.from_node_id, e.to_node_id) for e in graph.edges}
    assert all((b, a) in pairs for a, b in pairs)


def test_klaserie_grid_coordinates_within_park_bounds():
    graph = build_park_graph("klaserie")
    for node in graph.nodes:
        lon, lat = node.location.coordinates
        assert 31.0 < lon < 31.4
        assert -24.4 < lat < -24.0
