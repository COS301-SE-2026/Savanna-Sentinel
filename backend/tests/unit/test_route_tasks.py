from unittest.mock import AsyncMock, patch

from app.schemas.geo import GeoLineString
from app.schemas.route import ParkGraph, PlannedRoute
from app.workers.tasks.route_tasks import (
    _serialize_route,
    run_route_planning_job,
)


def _make_route(path, risk):
    return PlannedRoute(
        suggested_path=path,
        path_geometry=GeoLineString(coordinates=[(0.0, 0.0), (1.0, 1.0)]),
        estimated_time_min=6.0,
        estimated_fuel_l=0.3,
        risk_coverage=risk,
    )


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
        "estimated_time_min": 6.0,
        "estimated_fuel_l": 0.3,
        "risk_coverage": 0.75,
    }


# run_route_planning_job


@patch("app.workers.tasks.route_tasks.plan_routes")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph", new_callable=AsyncMock)
def test_run_route_planning_job_wires_graph_lookup_and_planning(
    mock_build_graph, mock_find_nearest, mock_plan_routes,
):
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    routes = [_make_route(["cell-start", "cell-end"], 0.5)]
    mock_plan_routes.return_value = routes

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        max_time_min=120.0,
        max_fuel_l=10.0,
        num_alternatives=3,
    )

    mock_build_graph.assert_called_once_with(None, "klaserie")
    assert mock_find_nearest.call_args_list[0].args == (
        graph, (31.05, -24.3),
    )
    assert mock_find_nearest.call_args_list[1].args == (graph, (31.1, -24.2))
    mock_plan_routes.assert_called_once()
    plan_args = mock_plan_routes.call_args.args
    assert plan_args[0] is graph
    assert plan_args[1] == "cell-start"
    assert plan_args[2] == "cell-end"
    assert plan_args[3] == 120.0
    assert plan_args[4] == 10.0
    assert plan_args[5] == 3

    assert result == {
        "park_id": "klaserie",
        "num_alternatives_requested": 3,
        "num_alternatives_found": 1,
        "results": [_serialize_route(r) for r in routes],
    }


@patch("app.workers.tasks.route_tasks.plan_routes")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph", new_callable=AsyncMock)
def test_run_route_planning_job_found_count_may_be_less_than_requested(
    mock_build_graph, mock_find_nearest, mock_plan_routes,
):
    """num_alternatives_found must be honest, not padded to match request.

    The gating in plan_routes() can drop phases.
    """
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    mock_plan_routes.return_value = [_make_route(["cell-start"], 0.2)]

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        max_time_min=120.0,
        max_fuel_l=10.0,
        num_alternatives=3,
    )

    assert result["num_alternatives_requested"] == 3
    assert result["num_alternatives_found"] == 1


@patch("app.workers.tasks.route_tasks.plan_routes")
@patch("app.workers.tasks.route_tasks.find_nearest_node")
@patch("app.workers.tasks.route_tasks.build_park_graph", new_callable=AsyncMock)
def test_run_route_planning_job_no_accepted_routes_returns_empty_results(
    mock_build_graph, mock_find_nearest, mock_plan_routes,
):
    graph = ParkGraph(park_id="klaserie", nodes=[], edges=[])
    mock_build_graph.return_value = graph
    mock_find_nearest.side_effect = ["cell-start", "cell-end"]
    mock_plan_routes.return_value = []

    result = run_route_planning_job(
        park_id="klaserie",
        start=(31.05, -24.3),
        end=(31.1, -24.2),
        max_time_min=120.0,
        max_fuel_l=10.0,
        num_alternatives=3,
    )

    assert result["num_alternatives_found"] == 0
    assert result["results"] == []
