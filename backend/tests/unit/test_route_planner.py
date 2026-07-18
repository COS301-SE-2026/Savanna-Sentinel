"""Unit tests for the route planner.

using a small deterministic graph fixture and then test the helper
functions plus the high-level plan_routes().
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph, PlannedRoute
from app.workers.ml import route_planner


@dataclass(frozen=True)
class SimpleGraphFixture:
    graph: ParkGraph
    start_node_id: str
    mid_node_id: str
    end_node_id: str


def make_graph() -> SimpleGraphFixture:
    nodes = [
        GraphNode(
            node_id="start",
            location=GeoPoint(coordinates=(18.4200, -33.9200)),
            risk_score=0.1,
        ),
        GraphNode(
            node_id="mid",
            location=GeoPoint(coordinates=(18.4250, -33.9180)),
            risk_score=0.7,
        ),
        GraphNode(
            node_id="end",
            location=GeoPoint(coordinates=(18.4300, -33.9160)),
            risk_score=0.4,
        ),
    ]

    edges = [
        GraphEdge(
            "start", "mid", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
        ),
        GraphEdge(
            "mid", "end", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
        ),
        GraphEdge(
            "start", "end", distance_km=2.0, est_time_min=25.0, est_fuel_l=3.5,
        ),
    ]

    return SimpleGraphFixture(
        graph=ParkGraph(park_id="park-001", nodes=nodes, edges=edges),
        start_node_id="start",
        mid_node_id="mid",
        end_node_id="end",
    )

# Check if init uses tau max
def test_init_pheromones():
    fixture = make_graph()
    config = route_planner.ACOConfig(tau_max=4.2)

    pheromones = route_planner.init_pheromones(fixture.graph, config)

    assert pheromones == {
        ("start", "mid"): 4.2,
        ("mid", "end"): 4.2,
        ("start", "end"): 4.2,
    }


def test_feasible_edges_filter():
    fixture = make_graph()

    edges = route_planner.feasible_edges(
        fixture.graph,
        current_node="start",
        end_node_id=fixture.end_node_id,
        visited={"start"},
        time_remaining=20.0,
        fuel_remaining=3.0,
    )

    assert [edge.to_node_id for edge in edges] == ["mid"]

# Make sure picks highest weight
def test_select_next_edge(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig(alpha=1.0, beta=1.0)
    candidates = [
        GraphEdge(
            "start", "mid", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
        ),
        GraphEdge(
            "start", "end", distance_km=2.0, est_time_min=25.0, est_fuel_l=3.5,
        ),
    ]

    monkeypatch.setattr(route_planner.random, "uniform", lambda a, b: 0.0)

    chosen = route_planner.select_next_edge(
        candidates,
        pheromones={("start", "mid"): 1.0, ("start", "end"): 1.0},
        graph=fixture.graph,
        config=config,
    )

    assert chosen is not None
    assert chosen.to_node_id == "mid"

# Check if return cost is 0 on same node
def test_estimate_return_cost_zero():
    fixture = make_graph()

    assert route_planner.estimate_return_cost(
        fixture.graph, "start", "start",
    ) == (0.0, 0.0)
    assert route_planner.estimate_return_cost(
        fixture.graph, "missing", fixture.end_node_id,
    ) == (0.0, 0.0)

# decays
def test_update_pheromones():
    fixture = make_graph()
    config = route_planner.ACOConfig(rho=0.1, tau_min=0.01, tau_max=1.0)
    pheromones = route_planner.init_pheromones(fixture.graph, config)

    updated = route_planner.update_pheromones(
        pheromones,
        best_path=[
            fixture.start_node_id,
            fixture.mid_node_id,
            fixture.end_node_id,
        ],
        best_risk=0.5,
        config=config,
    )

    assert updated[("start", "mid")] == pytest.approx(0.95)
    assert updated[("mid", "end")] == pytest.approx(0.95)
    assert updated[("start", "end")] == pytest.approx(0.9)

def test_apply_partial_penalty():
    fixture = make_graph()
    config = route_planner.ACOConfig(penalty_factor=0.3, tau_min=0.2)
    pheromones = {
        ("start", "mid"): 1.0,
        ("mid", "end"): 0.4,
        ("start", "end"): 0.9,
    }

    penalized = route_planner.apply_partial_penalty(
        pheromones,
        used_path=[
            fixture.start_node_id,
            fixture.mid_node_id,
            fixture.end_node_id,
        ],
        config=config,
    )

    assert penalized[("start", "mid")] == pytest.approx(0.3)
    assert penalized[("mid", "end")] == pytest.approx(0.2)
    assert penalized[("start", "end")] == pytest.approx(0.9)


def test_construct_tour(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig()
    start_to_mid = GraphEdge(
        "start", "mid", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
    )
    mid_to_end = GraphEdge(
        "mid", "end", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.5,
    )

    feasible_calls = iter(
        [
            [start_to_mid],
            [mid_to_end],
        ],
    )

    monkeypatch.setattr(
        route_planner,
        "feasible_edges",
        lambda *args, **kwargs: next(feasible_calls),
    )
    monkeypatch.setattr(
        route_planner,
        "select_next_edge",
        lambda candidates, *_: candidates[0],
    )

    path, time_used, fuel_used, risk_total = route_planner.construct_tour(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time=30.0,
        max_fuel=5.0,
        pheromones={("start", "mid"): 1.0, ("mid", "end"): 1.0},
        config=config,
    )

    assert path == ["start", "mid", "end"]
    assert time_used == pytest.approx(20.0)
    assert fuel_used == pytest.approx(3.0)
    assert risk_total == pytest.approx(1.1)

def test_construct_tour_stops_when_no_feasible_edge_exists(monkeypatch):
    fixture = make_graph()
    config = route_planner.ACOConfig()

    monkeypatch.setattr(
        route_planner, "feasible_edges", lambda *args, **kwargs: [],
    )
    monkeypatch.setattr(
        route_planner, "select_next_edge", lambda *args, **kwargs: None,
    )

    path, time_used, fuel_used, risk_total = route_planner.construct_tour(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time=30.0,
        max_fuel=5.0,
        pheromones={},
        config=config,
    )

    assert path == ["start"]
    assert time_used == 0.0
    assert fuel_used == 0.0
    assert risk_total == 0.0

def test_run_phase_returns_best(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=2)
    calls = []

    def fake_construct_tour(*args, **kwargs):
        return (
            [fixture.start_node_id, fixture.mid_node_id, fixture.end_node_id],
            20.0,
            3.0,
            0.8,
        )

    def fake_update_pheromones(pheromones, best_path, best_risk, config):
        calls.append((best_path, best_risk))
        return {"updated": True}

    monkeypatch.setattr(route_planner, "construct_tour", fake_construct_tour)
    monkeypatch.setattr(
        route_planner, "update_pheromones", fake_update_pheromones,
    )

    best_path, best_risk, pheromones = route_planner.run_phase(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time=30.0,
        max_fuel=5.0,
        pheromones={"initial": True},
        num_iterations=3,
        config=config,
    )

    assert best_path == ["start", "mid", "end"]
    assert best_risk == 0.8
    assert pheromones == {"updated": True}
    assert calls == [
        (["start", "mid", "end"], 0.8),
        (["start", "mid", "end"], 0.8),
        (["start", "mid", "end"], 0.8),
    ]

def test_run_phase_skips_iterations_without_complete_tours(monkeypatch):
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=2)

    monkeypatch.setattr(
        route_planner,
        "construct_tour",
        lambda *args, **kwargs: (
            [fixture.start_node_id, fixture.mid_node_id],
            10.0,
            1.5,
            0.2,
        ),
    )
    monkeypatch.setattr(
        route_planner,
        "update_pheromones",
        lambda *args, **kwargs: pytest.fail(
            "update_pheromones was called when no complete tours exist",
        ),
    )

    best_path, best_risk, pheromones = route_planner.run_phase(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time=30.0,
        max_fuel=5.0,
        pheromones={"initial": True},
        num_iterations=2,
        config=config,
    )

    assert best_path == []
    assert best_risk == -1.0
    assert pheromones == {"initial": True}

def test_to_planned_route_builds_geometry_and_sums_edge_costs():
    fixture = make_graph()

    route = route_planner._to_planned_route(
        fixture.graph,
        path=[fixture.start_node_id, fixture.mid_node_id, fixture.end_node_id],
        risk_coverage=0.83,
    )

    assert isinstance(route, PlannedRoute)
    assert route.suggested_path == ["start", "mid", "end"]
    assert route.estimated_time_min == 20.0
    assert route.estimated_fuel_l == 3.0
    assert route.risk_coverage == 0.83
    assert route.path_geometry.type == "LineString"
    assert len(route.path_geometry.coordinates) >= 2


def test_is_sufficiently_diverse_rejects_too_similar_paths():
    candidate = ["start", "mid", "end"]
    prior_paths = [["start", "mid", "end"]]

    assert (
        route_planner.is_sufficiently_diverse(
            candidate, prior_paths, threshold=0.3,
        )
        is False
    )

def test_best_risk_threshold():
    config = route_planner.ACOConfig(quality_threshold=0.9)

    assert route_planner.is_sufficient_quality(0.91, 1.0, config) is True
    assert route_planner.is_sufficient_quality(0.80, 1.0, config) is False


def test_plan_routes_accepts_paths_from_each_phase(monkeypatch):
    fixture = make_graph()
    config = route_planner.ACOConfig(
        total_iterations=10, phase_split=(0.5, 0.5, 0.0),
    )

    phase_results = iter(
        [
            (["start", "mid", "end"], 0.8),
            (["start", "mid", "end"], 0.8),
            (["start", "end"], 0.95),
        ],
    )
    penalty_calls: list[list[str]] = []

    def fake_run_phase(*args, **kwargs):
        path, risk = next(phase_results)
        return path, risk, {}

    monkeypatch.setattr(route_planner, "run_phase", fake_run_phase)
    monkeypatch.setattr(
        route_planner,
        "apply_partial_penalty",
        lambda pheromones, used_path, config: penalty_calls.append(used_path)
        or pheromones,
    )

    routes = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time_min=30.0,
        max_fuel_l=5.0,
        num_alternatives=2,
        config=config,
    )

    assert len(routes) == 2
    assert [route.suggested_path for route in routes] == [
        ["start", "mid", "end"],
        ["start", "end"],
    ]
    assert len(penalty_calls) == 3
    assert penalty_calls[0] == ["start", "mid", "end"]
    assert penalty_calls[1] == ["start", "mid", "end"]
    assert penalty_calls[2] == ["start", "end"]


def test_routes_skips_empty_phase_results(monkeypatch):
    fixture = make_graph()
    config = route_planner.ACOConfig(
        total_iterations=10, phase_split=(1.0, 0.0, 0.0),
    )

    monkeypatch.setattr(
        route_planner, "run_phase", lambda *args, **kwargs: ([], 0.0, {}),
    )
    monkeypatch.setattr(
        route_planner,
        "apply_partial_penalty",
        lambda pheromones, used_path, config: pheromones,
    )

    routes = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time_min=30.0,
        max_fuel_l=5.0,
        num_alternatives=1,
        config=config,
    )

    assert routes == []
