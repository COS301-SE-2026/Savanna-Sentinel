import json
import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pyproj import Transformer
from shapely.geometry import LineString, Point, box

from app.schemas.geo import GeoLineString
from app.schemas.route import ParkGraph, PlannedRoute
from app.workers.ml.route_planner import STOP_IN_NO_GO, RoutePlan
from app.workers.ml.terrain_constraints import (
    ImpassableArea,
    TerrainConstraints,
)
from app.workers.tasks import route_tasks
from app.workers.tasks.route_tasks import (
    RouteTerrain,
    _load_terrain,
    _serialize_route,
    _stop_in_no_go,
    run_route_planning_job,
)

_EPSG = 32736
_TO_LONLAT = Transformer.from_crs(f"EPSG:{_EPSG}", "EPSG:4326", always_xy=True)
_CELL = box(300000.0, 7300000.0, 301000.0, 7301000.0)


def _make_route(path, risk):
    return PlannedRoute(
        suggested_path=path,
        path_geometry=GeoLineString(coordinates=[(0.0, 0.0), (1.0, 1.0)]),
        distance_km=6.0,
        risk_coverage=risk,
    )


def _lonlat(x, y):
    return _TO_LONLAT.transform(x, y)


@pytest.fixture(autouse=True)
def no_terrain():
    """Plan on a bare grid unless a test supplies its own terrain."""
    with patch.object(
        route_tasks,
        "_load_terrain",
        return_value=RouteTerrain(),
    ) as mock_load:
        yield mock_load


# _serialize_route


def test_serialize_route_returns_plain_dict_with_geometry_dumped():
    route = _make_route(["cell-1", "cell-2"], 0.75)

    data = _serialize_route(route)

    assert data == {
        "suggested_path": ["cell-1", "cell-2"],
        "path_geometry": {
            "type": "LineString",
            "coordinates": [(0.0, 0.0), (1.0, 1.0)],
        },
        "distance_km": 6.0,
        "risk_coverage": 0.75,
    }


# run_route_planning_job


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_wires_graph_lookup_and_planning(
    mock_build_graph,
    mock_find_nearest,
    mock_plan_routes,
):
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    routes = [_make_route(["cell-start", "cell-end"], 0.5)]
    mock_plan_routes.return_value = RoutePlan(routes=routes, shortfall=None)

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        num_alternatives=3,
        risk_by_cell={"cell-1": 0.6},
    )

    mock_build_graph.assert_called_once()
    assert mock_build_graph.call_args.args == ("klaserie", {"cell-1": 0.6})
    assert mock_find_nearest.call_args_list[0].args[:2] == (
        graph,
        (31.05, -24.3),
    )
    assert mock_find_nearest.call_args_list[1].args[:2] == (
        graph,
        (31.1, -24.2),
    )
    mock_plan_routes.assert_called_once()
    plan_args = mock_plan_routes.call_args.args
    assert plan_args[0] is graph
    assert plan_args[1] == ["cell-start", "cell-end"]
    assert plan_args[2] == 3

    assert result == {
        "park_id": "klaserie",
        "num_alternatives_requested": 3,
        "num_alternatives_found": 1,
        "shortfall_reason": None,
        "terrain_stale": False,
        "results": [_serialize_route(r) for r in routes],
    }


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_defaults_risk_by_cell_to_none(
    mock_build_graph,
    mock_find_nearest,
    mock_plan_routes,
):
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    mock_plan_routes.return_value = RoutePlan(routes=[], shortfall=None)

    run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        num_alternatives=3,
    )

    assert mock_build_graph.call_args.args == ("klaserie", None)


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_found_count_may_be_less_than_requested(
    mock_build_graph,
    mock_find_nearest,
    mock_plan_routes,
):
    """num_alternatives_found must be honest, not padded to match request.

    The gating in plan_routes() can drop phases.
    """
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    mock_plan_routes.return_value = RoutePlan(
        routes=[_make_route(["cell-start"], 0.2)],
        shortfall="longer_than_best",
    )

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        num_alternatives=3,
    )

    assert result["num_alternatives_requested"] == 3
    assert result["num_alternatives_found"] == 1
    assert result["shortfall_reason"] == "longer_than_best"


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_no_accepted_routes_returns_empty_results(
    mock_build_graph,
    mock_find_nearest,
    mock_plan_routes,
):
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    mock_plan_routes.return_value = RoutePlan(
        routes=[], shortfall="no_tour_found",
    )

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        num_alternatives=3,
    )

    assert result["num_alternatives_found"] == 0
    assert result["shortfall_reason"] == "no_tour_found"
    assert result["results"] == []


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_snaps_waypoints_between_start_and_end(
    mock_build, mock_nearest, mock_plan,
):
    mock_nearest.side_effect = lambda graph, point, _: f"node-{point[0]}"
    mock_plan.return_value = RoutePlan(routes=[])

    run_route_planning_job(
        park_id="park-001",
        start=(1.0, 0.0),
        end=(4.0, 0.0),
        num_alternatives=3,
        waypoints=[(2.0, 0.0), (3.0, 0.0)],
    )

    assert mock_plan.call_args.args[1] == [
        "node-1.0", "node-2.0", "node-3.0", "node-4.0",
    ]


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_without_waypoints_plans_start_to_end(
    mock_build, mock_nearest, mock_plan,
):
    mock_nearest.side_effect = lambda graph, point, _: f"node-{point[0]}"
    mock_plan.return_value = RoutePlan(routes=[])

    run_route_planning_job(
        park_id="park-001",
        start=(1.0, 0.0),
        end=(4.0, 0.0),
        num_alternatives=3,
    )

    assert mock_plan.call_args.args[1] == ["node-1.0", "node-4.0"]


# run_route_planning_job terrain


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_plans_on_the_terrain(
    mock_build_graph,
    mock_find_nearest,
    mock_plan_routes,
    no_terrain,
):
    constraints = TerrainConstraints(epsg=_EPSG)
    no_terrain.return_value = RouteTerrain(
        route_costs={"cell-1": 50.0},
        constraints=constraints,
        terrain_key="3:abc",
        stale=True,
    )
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    mock_plan_routes.return_value = RoutePlan(routes=[])

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        num_alternatives=3,
    )

    kwargs = mock_build_graph.call_args.kwargs
    assert kwargs["route_cost_by_cell"] == {"cell-1": 50.0}
    assert kwargs["constraints"] is constraints
    assert kwargs["terrain_key"] == "3:abc"
    assert mock_find_nearest.call_args.args[2] is constraints
    assert result["terrain_stale"] is True


@patch("app.workers.tasks.route_tasks.plan_routes_via")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph")
def test_run_route_planning_job_rejects_a_stop_in_a_no_go_area(
    mock_build_graph,
    mock_find_nearest,
    mock_plan_routes,
    no_terrain,
):
    lake = ImpassableArea("lake", 1, box(300200, 7300200, 300800, 7300800))
    no_terrain.return_value = RouteTerrain(
        constraints=TerrainConstraints(areas=[lake], epsg=_EPSG),
        cells=[("cell-0", _CELL)],
    )

    result = run_route_planning_job(
        park_id="klaserie",
        start=_lonlat(300100, 7300100),
        end=_lonlat(300900, 7300900),
        num_alternatives=3,
        waypoints=[_lonlat(300500, 7300500)],
    )

    assert result["shortfall_reason"] == STOP_IN_NO_GO
    assert result["num_alternatives_found"] == 0
    assert result["results"] == []
    mock_find_nearest.assert_not_called()
    mock_plan_routes.assert_not_called()


# _stop_in_no_go


def _terrain_with_lake(top_priority=None):
    lake = ImpassableArea("lake", 1, box(300200, 7300200, 300800, 7300800))
    return RouteTerrain(
        constraints=TerrainConstraints(
            areas=[lake],
            top_priority=top_priority or {},
            epsg=_EPSG,
        ),
        cells=[("cell-0", _CELL)],
    )


def test_stop_in_no_go_inside_an_area():
    terrain = _terrain_with_lake()
    assert _stop_in_no_go(terrain, _lonlat(300500, 7300500))
    assert not _stop_in_no_go(terrain, _lonlat(300100, 7300100))


def test_stop_in_no_go_allows_a_higher_priority_cell():
    terrain = _terrain_with_lake(top_priority={"cell-0": 2})
    assert not _stop_in_no_go(terrain, _lonlat(300500, 7300500))


def test_stop_in_no_go_without_areas():
    assert not _stop_in_no_go(RouteTerrain(), (31.0, -24.0))


# _load_terrain


def _snapshot():
    lon0, lat0 = _lonlat(300500, 7300000)
    lon1, lat1 = _lonlat(300500, 7301000)
    return {
        "layers": [],
        "memberships": [],
        "features": [
            {
                "id": "river",
                "type": "line",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[lon0, lat0], [lon1, lat1]],
                },
                "in_effect": True,
                "buffer_enabled": False,
                "buffer_distance_m": 100.0,
                "rules": {"avoid": {"strength": 1.0, "priority": 2}},
            },
        ],
    }


def _patch_reads(effects, meta):
    workspace_repo = MagicMock()
    workspace_repo.get_version = AsyncMock(return_value=7)
    workspace_repo.load_snapshot = AsyncMock(return_value=_snapshot())
    terrain_repo = MagicMock()
    terrain_repo.get_effects = AsyncMock(return_value=effects)
    terrain_repo.get_meta = AsyncMock(return_value=meta)
    session = MagicMock()
    session.return_value.__aenter__.return_value = AsyncMock()
    return (
        patch.object(route_tasks, "_TaskSessionLocal", session),
        patch.object(
            route_tasks,
            "WorkspaceRepository",
            return_value=workspace_repo,
        ),
        patch.object(
            route_tasks,
            "TerrainRepository",
            return_value=terrain_repo,
        ),
        patch.object(
            route_tasks,
            "load_projected_cells",
            return_value=([("cell-0", _CELL)], _EPSG),
        ),
    )


def test_load_terrain_builds_costs_constraints_and_key():
    effects = [("cell-0", 0.0, 50.0), ("cell-1", 0.2, 1.0)]
    meta = {"requested_hash": "h1", "computed_hash": "h1"}

    patches = _patch_reads(effects, meta)
    with patches[0], patches[1], patches[2], patches[3]:
        terrain = _load_terrain()

    assert terrain.route_costs == {"cell-0": 50.0, "cell-1": 1.0}
    assert [a.feature_id for a in terrain.constraints.areas] == ["river"]
    assert terrain.constraints.epsg == _EPSG
    assert terrain.cells == [("cell-0", _CELL)]
    assert terrain.terrain_key == "7:h1"
    assert terrain.stale is False


def test_load_terrain_flags_a_pending_recompute():
    meta = {"requested_hash": "new", "computed_hash": "old"}

    patches = _patch_reads([], meta)
    with patches[0], patches[1], patches[2], patches[3]:
        terrain = _load_terrain()

    assert terrain.stale is True
    assert terrain.terrain_key == "7:old"


# run_route_planning_job on the real park grid


def _seeded_main_river():
    seed = Path(__file__).resolve().parents[2] / (
        "init-db/04_seed_workspace_layers.sql"
    )
    match = re.search(r"'Main River','(\{.*?\})'", seed.read_text())
    return json.loads(match.group(1))


def test_route_on_the_real_grid_never_crosses_an_impassable_river(
    no_terrain,
):
    river = _seeded_main_river()
    snapshot = {
        "layers": [],
        "memberships": [],
        "features": [
            {
                "id": "river",
                "type": "line",
                "geometry": river,
                "in_effect": True,
                "buffer_enabled": False,
                "buffer_distance_m": 100.0,
                "rules": {"avoid": {"strength": 1.0}},
            },
        ],
    }
    meta = {"requested_hash": "h", "computed_hash": "h"}
    with patch.object(
        route_tasks,
        "_read_terrain",
        AsyncMock(return_value=(1, snapshot, [], meta)),
    ):
        no_terrain.return_value = _load_terrain()

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.10, -24.20),
        end=(31.20, -24.20),
        num_alternatives=1,
        seed=7,
    )

    terrain = no_terrain.return_value
    (area,) = terrain.constraints.areas
    straight = LineString(
        [
            terrain.constraints.to_grid((31.10, -24.20)),
            terrain.constraints.to_grid((31.20, -24.20)),
        ],
    )
    assert straight.intersects(area.area)
    graph = route_tasks.build_park_graph("klaserie")
    centres = {n.node_id: n.grid_xy for n in graph.nodes}
    assert result["results"]
    for route in result["results"]:
        path = LineString([centres[c] for c in route["suggested_path"]])
        drawn = LineString(
            [
                terrain.constraints.to_grid(c)
                for c in route["path_geometry"]["coordinates"]
            ],
        )
        assert not path.intersects(area.area)
        assert not drawn.intersects(area.area)


_SEEDED_BRIDGE = (31.144496809, -24.204771374)


def test_route_on_the_real_grid_crosses_the_river_on_the_bridge(no_terrain):
    snapshot = {
        "layers": [],
        "memberships": [],
        "features": [
            {
                "id": "river",
                "type": "line",
                "geometry": _seeded_main_river(),
                "in_effect": True,
                "buffer_enabled": False,
                "buffer_distance_m": 100.0,
                "rules": {"avoid": {"strength": 1.0, "priority": 1}},
            },
            {
                "id": "bridge",
                "type": "point",
                "geometry": {
                    "type": "Point",
                    "coordinates": list(_SEEDED_BRIDGE),
                },
                "in_effect": True,
                "buffer_enabled": True,
                "buffer_distance_m": 250.0,
                "rules": {"prefer": {"priority": 2}},
            },
        ],
    }
    meta = {"requested_hash": "h", "computed_hash": "h"}
    with patch.object(
        route_tasks,
        "_read_terrain",
        AsyncMock(return_value=(2, snapshot, [], meta)),
    ):
        no_terrain.return_value = _load_terrain()

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.10, -24.20),
        end=(31.20, -24.20),
        num_alternatives=3,
        seed=7,
    )

    constraints = no_terrain.return_value.constraints
    (river,) = constraints.areas
    bridge = Point(constraints.to_grid(_SEEDED_BRIDGE))
    assert result["results"]
    for route in result["results"]:
        drawn = LineString(
            [
                constraints.to_grid(c)
                for c in route["path_geometry"]["coordinates"]
            ],
        )
        hits = drawn.intersection(river.area)
        assert not hits.is_empty
        points = [hits] if hits.geom_type == "Point" else list(hits.geoms)
        assert all(point.distance(bridge) < 1.0 for point in points)
