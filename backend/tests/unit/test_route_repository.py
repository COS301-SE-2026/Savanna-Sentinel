import json

import pytest
from pyproj import Transformer
from shapely.geometry import LineString, box

from app.repositories import route_repository
from app.repositories.route_repository import (
    AVG_SPEED_KMH,
    build_park_graph,
    find_nearest_node,
)
from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph
from app.workers.ml.terrain_constraints import (
    ImpassableArea,
    TerrainConstraints,
    build_constraints,
)
from app.workers.terrain.constants import DEFAULT_RULE

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
    monkeypatch.setattr(route_repository, "GRID_FILE_PATH", path)
    route_repository._load_grid.cache_clear()
    yield "unit-test-2x2"
    route_repository._load_grid.cache_clear()


# _load_grid


def test_load_grid_builds_one_node_per_feature(grid_2x2):
    graph = route_repository._load_grid()
    assert len(graph.nodes) == 4
    assert {n.node_id for n in graph.nodes} == {
        "cell-1",
        "cell-2",
        "cell-3",
        "cell-4",
    }


def test_load_grid_converts_projected_coords_to_lon_lat(grid_2x2):
    """Reproduce the transform independently and compare exact output."""
    graph = route_repository._load_grid()
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


def test_load_grid_keeps_projected_cell_centres(grid_2x2):
    graph = route_repository._load_grid()
    node = next(n for n in graph.nodes if n.node_id == "cell-1")
    assert node.grid_xy == pytest.approx(
        (_BASE_LEFT + _CELL_M / 2, _BASE_TOP - _CELL_M / 2),
    )


def test_load_grid_nodes_have_neutral_risk_score(grid_2x2):
    """No risk heatmap exists yet - every node must be a neutral 0.0."""
    graph = route_repository._load_grid()
    assert all(n.risk_score == 0.0 for n in graph.nodes)


def test_load_grid_builds_8_connected_edges_with_diagonals(grid_2x2):
    """4 connected orthogonal neighbours plus both diagonal pairs.

    Diagonal edges let a route angle directly toward its target.
    """
    graph = route_repository._load_grid()
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
    graph = route_repository._load_grid()
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


def test_load_grid_raises_when_no_grid_uploaded_yet(tmp_path, monkeypatch):
    monkeypatch.setattr(
        route_repository,
        "GRID_FILE_PATH",
        tmp_path / "never-uploaded.geojson",
    )
    route_repository._load_grid.cache_clear()
    with pytest.raises(FileNotFoundError):
        route_repository._load_grid()
    route_repository._load_grid.cache_clear()


def test_load_grid_is_cached_across_calls(grid_2x2):
    """@lru_cache means repeated calls are free."""
    first = route_repository._load_grid()
    second = route_repository._load_grid()
    assert first is second


def test_invalidate_grid_cache_forces_a_reload(grid_2x2):
    first = route_repository._load_grid()

    route_repository.invalidate_grid_cache()

    second = route_repository._load_grid()
    assert first is not second


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
    cached = route_repository._load_grid()
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


# build_park_graph terrain


@pytest.fixture
def grid_5x5(tmp_path, monkeypatch):
    """Return a 5x5 grid, cell id row * 5 + col."""
    cells = [
        _cell(row * 5 + col, row=row, col=col)
        for row in range(5)
        for col in range(5)
    ]
    path = _write_grid(tmp_path, cells)
    monkeypatch.setattr(route_repository, "GRID_FILE_PATH", path)
    route_repository._load_grid.cache_clear()
    yield "unit-test-5x5"
    route_repository._load_grid.cache_clear()


def _id(row, col):
    return f"cell-{row * 5 + col}"


def _col_border(col):
    """North-south line along the western edge of a column."""
    x = _BASE_LEFT + col * _CELL_M
    return LineString([(x, _BASE_TOP), (x, _BASE_TOP - 5 * _CELL_M)])


def _cell_box(row, col):
    left = _BASE_LEFT + col * _CELL_M
    top = _BASE_TOP - row * _CELL_M
    return box(left, top - _CELL_M, left + _CELL_M, top)


def _pairs(edges):
    return {(e.from_node_id, e.to_node_id) for e in edges}


def _col(node_id):
    return int(node_id.removeprefix("cell-")) % 5


def _crosses_border(edges, col):
    return {
        (a, b) for a, b in _pairs(edges) if {_col(a), _col(b)} == {col - 1, col}
    }


def test_build_park_graph_without_terrain_keeps_the_full_grid(grid_5x5):
    graph = build_park_graph(grid_5x5)
    base = route_repository._load_grid()

    assert len(graph.nodes) == 25
    assert graph.edges == base.edges
    assert graph.neighbor_edges == base.edges
    assert graph.terrain_key == ""


def test_build_park_graph_passes_terrain_key_through(grid_5x5):
    graph = build_park_graph(grid_5x5, terrain_key="7:abc")
    assert graph.terrain_key == "7:abc"


def test_build_park_graph_keeps_projected_centres(grid_5x5):
    graph = build_park_graph(grid_5x5)
    assert all(n.grid_xy is not None for n in graph.nodes)


def test_line_barrier_blocks_crossing_moves_but_keeps_both_banks(grid_5x5):
    river = ImpassableArea("river", 1, _col_border(2))
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(areas=[river]),
    )

    assert len(graph.nodes) == 25
    assert _crosses_border(graph.edges, 2) == set()
    assert (_id(2, 0), _id(2, 1)) in _pairs(graph.edges)
    assert (_id(2, 2), _id(2, 3)) in _pairs(graph.edges)


def test_line_barrier_moves_stay_in_neighbor_edges(grid_5x5):
    river = ImpassableArea("river", 1, _col_border(2))
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(areas=[river]),
    )

    # 5 orthogonal and 8 diagonal crossings, both directions
    assert len(_crosses_border(graph.neighbor_edges, 2)) == 26


def test_area_barrier_removes_cells_whose_centre_is_inside(grid_5x5):
    lake = ImpassableArea("lake", 1, _cell_box(2, 2))
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(areas=[lake]),
    )

    assert _id(2, 2) not in {n.node_id for n in graph.nodes}
    for edges in (graph.edges, graph.neighbor_edges):
        assert all(_id(2, 2) not in pair for pair in _pairs(edges))


def test_area_barrier_blocks_moves_cutting_across_it(grid_5x5):
    # covers the shared corner of four cells without holding any centre
    corner_x = _BASE_LEFT + 2 * _CELL_M
    corner_y = _BASE_TOP - 2 * _CELL_M
    rock = ImpassableArea(
        "rock",
        1,
        box(corner_x - 100, corner_y - 100, corner_x + 100, corner_y + 100),
    )
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(areas=[rock]),
    )
    pairs = _pairs(graph.edges)

    assert len(graph.nodes) == 25
    assert (_id(1, 1), _id(2, 2)) not in pairs
    assert (_id(1, 2), _id(2, 1)) not in pairs
    assert (_id(1, 1), _id(1, 2)) in pairs


def test_higher_priority_cell_lets_moves_cross_the_barrier(grid_5x5):
    river = ImpassableArea("river", 1, _col_border(2))
    bridge_cell = _id(2, 1)
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(
            areas=[river],
            top_priority={bridge_cell: 2},
        ),
    )

    crossings = _crosses_border(graph.edges, 2)
    assert crossings
    assert all(bridge_cell in pair for pair in crossings)
    assert (bridge_cell, _id(2, 2)) in crossings
    assert (_id(0, 1), _id(0, 2)) not in crossings


def test_equal_priority_cell_does_not_open_the_barrier(grid_5x5):
    river = ImpassableArea("river", 2, _col_border(2))
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(
            areas=[river],
            top_priority={_id(2, 1): 2},
        ),
    )

    assert _crosses_border(graph.edges, 2) == set()


def test_higher_priority_cell_inside_an_area_is_kept(grid_5x5):
    lake = ImpassableArea("lake", 1, _cell_box(2, 2))
    graph = build_park_graph(
        grid_5x5,
        constraints=TerrainConstraints(
            areas=[lake],
            top_priority={_id(2, 2): 3},
        ),
    )

    assert _id(2, 2) in {n.node_id for n in graph.nodes}


def test_route_costs_scale_time_but_not_distance(grid_5x5):
    base = route_repository._load_grid()
    graph = build_park_graph(
        grid_5x5,
        route_cost_by_cell={_id(0, 0): 3.0},
    )
    before = {(e.from_node_id, e.to_node_id): e for e in base.edges}
    after = {(e.from_node_id, e.to_node_id): e for e in graph.edges}

    pair = (_id(0, 0), _id(0, 1))
    assert after[pair].est_time_min == pytest.approx(
        before[pair].est_time_min * 2.0,
    )
    assert after[pair].distance_km == before[pair].distance_km
    untouched = (_id(3, 3), _id(3, 4))
    assert after[untouched] is before[untouched]


def test_terrain_does_not_mutate_cached_load_grid_result(grid_5x5):
    lake = ImpassableArea("lake", 1, _cell_box(2, 2))
    build_park_graph(
        grid_5x5,
        route_cost_by_cell={_id(0, 0): 3.0},
        constraints=TerrainConstraints(areas=[lake]),
    )

    cached = route_repository._load_grid()
    assert len(cached.nodes) == 25
    assert len(cached.edges) == 144
    assert all(
        e.est_time_min
        == pytest.approx(
            e.distance_km / AVG_SPEED_KMH * 60,
        )
        for e in cached.edges
    )


def test_constraints_from_workspace_features_split_the_grid(grid_5x5):
    to_lonlat = Transformer.from_crs(
        f"EPSG:{_EPSG}",
        "EPSG:4326",
        always_xy=True,
    )
    river = {
        "id": "river",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                list(to_lonlat.transform(x, y))
                for x, y in _col_border(2).coords
            ],
        },
        "buffer_enabled": False,
        "buffer_distance_m": 100.0,
    }
    resolved = {"river": {"avoid": {**DEFAULT_RULE, "strength": 1.0}}}
    cells = [
        (_id(row, col), _cell_box(row, col))
        for row in range(5)
        for col in range(5)
    ]

    graph = build_park_graph(
        grid_5x5,
        constraints=build_constraints(cells, _EPSG, [river], resolved),
    )

    assert len(graph.nodes) == 25
    assert _crosses_border(graph.edges, 2) == set()


# find_nearest_node


def test_find_nearest_node_returns_closest_node():
    graph = ParkGraph(
        park_id="p",
        nodes=[
            GraphNode(
                node_id="a",
                location=GeoPoint(coordinates=(31.0, -24.0)),
                risk_score=0.0,
            ),
            GraphNode(
                node_id="b",
                location=GeoPoint(coordinates=(31.1, -23.9)),
                risk_score=0.0,
            ),
            GraphNode(
                node_id="c",
                location=GeoPoint(coordinates=(31.095, -23.905)),
                risk_score=0.0,
            ),
        ],
        edges=[],
    )
    assert find_nearest_node(graph, (31.099, -23.901)) == "b"
    assert find_nearest_node(graph, (31.001, -24.001)) == "a"


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


def test_find_nearest_node_scales_longitude_by_latitude():
    """At -24 deg a degree of longitude is ~9% shorter than one of latitude."""
    graph = ParkGraph(
        park_id="p",
        nodes=[
            GraphNode(
                node_id="east",
                location=GeoPoint(coordinates=(31.01, -24.0)),
                risk_score=0.0,
            ),
            GraphNode(
                node_id="north",
                location=GeoPoint(coordinates=(31.0, -23.99)),
                risk_score=0.0,
            ),
        ],
        edges=[],
    )
    # Equidistant in raw degrees, so only the projection can break the tie.
    assert find_nearest_node(graph, (31.0, -24.0)) == "east"


def test_find_nearest_node_rejects_a_point_far_outside_the_grid():
    graph = ParkGraph(
        park_id="p",
        nodes=[
            GraphNode(
                node_id="only",
                location=GeoPoint(coordinates=(31.0, -24.0)),
                risk_score=0.0,
            ),
        ],
        edges=[],
    )
    with pytest.raises(ValueError, match="outside the park grid"):
        find_nearest_node(graph, (18.42, -33.92))


def test_find_nearest_node_allows_a_point_just_outside_the_grid():
    graph = ParkGraph(
        park_id="p",
        nodes=[
            GraphNode(
                node_id="only",
                location=GeoPoint(coordinates=(31.0, -24.0)),
                risk_score=0.0,
            ),
        ],
        edges=[],
    )
    assert find_nearest_node(graph, (31.0, -24.009)) == "only"


def test_find_nearest_node_scales_the_bound_to_the_cell_size():
    """A coarser grid tolerates a proportionally further snap."""
    node = GraphNode(
        node_id="only",
        location=GeoPoint(coordinates=(31.0, -24.0)),
        risk_score=0.0,
    )
    point = (31.0, -24.05)

    fine = ParkGraph(park_id="p", nodes=[node], edges=[])
    with pytest.raises(ValueError, match="outside the park grid"):
        find_nearest_node(fine, point)

    coarse = ParkGraph(
        park_id="p",
        nodes=[node],
        edges=[
            GraphEdge(
                "only",
                "only",
                distance_km=10.0,
                est_time_min=30.0,
            ),
        ],
    )
    assert find_nearest_node(coarse, point) == "only"


def test_find_nearest_node_rejects_an_empty_grid():
    graph = ParkGraph(park_id="p", nodes=[], edges=[])
    with pytest.raises(ValueError, match="no cells"):
        find_nearest_node(graph, (31.0, -24.0))


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
