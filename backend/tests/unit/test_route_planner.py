"""Unit tests for the route planner.

using a small deterministic graph fixture and then test the helper
functions plus the high-level plan_routes().
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

import pytest

from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph, PlannedRoute
from app.workers.ml import route_planner
from app.workers.ml.shortest_path import PathResult


class FixedRandom:

    def __init__(self, fraction: float = 0.01):
        self.fraction = fraction

    def uniform(self, a: float, b: float) -> float:
        return b * self.fraction

    def choice(self, seq):
        return seq[0]


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
            "start",
            "mid",
            distance_km=1.0,
            est_time_min=10.0,
            est_fuel_l=1.5,
        ),
        GraphEdge(
            "mid",
            "end",
            distance_km=1.0,
            est_time_min=10.0,
            est_fuel_l=1.5,
        ),
        GraphEdge(
            "start",
            "end",
            distance_km=2.0,
            est_time_min=25.0,
            est_fuel_l=3.5,
        ),
    ]

    return SimpleGraphFixture(
        graph=ParkGraph(park_id="park-001", nodes=nodes, edges=edges),
        start_node_id="start",
        mid_node_id="mid",
        end_node_id="end",
    )


def make_line_graph() -> ParkGraph:
    """5 nodes in a line, each only adjacent to its immediate neighbour(s).

    Unlike make_graph()'s fully-connected triangle, this gives a clear
    "1 hop away" vs "2+ hops away" distinction for testing coverage.
    p3 is the only high-risk cell; p1 and p5 are 2 hops from it.
    """
    nodes = [
        GraphNode(
            node_id="p1",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.0,
        ),
        GraphNode(
            node_id="p2",
            location=GeoPoint(coordinates=(1.0, 0.0)),
            risk_score=0.0,
        ),
        GraphNode(
            node_id="p3",
            location=GeoPoint(coordinates=(2.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="p4",
            location=GeoPoint(coordinates=(3.0, 0.0)),
            risk_score=0.4,
        ),
        GraphNode(
            node_id="p5",
            location=GeoPoint(coordinates=(4.0, 0.0)),
            risk_score=0.0,
        ),
    ]
    pairs = [("p1", "p2"), ("p2", "p3"), ("p3", "p4"), ("p4", "p5")]
    edges = []
    for a, b in pairs:
        edges.append(
            GraphEdge(
                a,
                b,
                distance_km=1.0,
                est_time_min=3.0,
                est_fuel_l=0.15,
            ),
        )
        edges.append(
            GraphEdge(
                b,
                a,
                distance_km=1.0,
                est_time_min=3.0,
                est_fuel_l=0.15,
            ),
        )
    return ParkGraph(park_id="line", nodes=nodes, edges=edges)


# _coverage_neighbors / covered_nodes


def test_covered_nodes_includes_direct_graph_neighbors():
    graph = make_line_graph()
    assert route_planner.covered_nodes(graph, ["p2"]) == {"p1", "p2", "p3"}


def test_covered_nodes_excludes_nodes_two_hops_away():
    graph = make_line_graph()
    covered = route_planner.covered_nodes(graph, ["p1"])
    assert "p3" not in covered
    assert covered == {"p1", "p2"}


def test_covered_nodes_unions_neighbors_across_the_whole_path():
    graph = make_line_graph()
    covered = route_planner.covered_nodes(graph, ["p1", "p5"])
    assert covered == {"p1", "p2", "p4", "p5"}


# select_waypoints


def test_select_waypoints_covers_a_cluster_with_one_representative():
    """3-node chain, all high-risk: middle node's radius covers the rest."""
    nodes = [
        GraphNode(
            node_id="a1",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="a2",
            location=GeoPoint(coordinates=(1.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="a3",
            location=GeoPoint(coordinates=(2.0, 0.0)),
            risk_score=0.9,
        ),
    ]
    edges = [
        GraphEdge(
            "a1",
            "a2",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
        GraphEdge(
            "a2",
            "a1",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
        GraphEdge(
            "a2",
            "a3",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
        GraphEdge(
            "a3",
            "a2",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=edges)

    assert route_planner.select_waypoints(graph) == ["a2"]


def test_select_waypoints_needs_one_per_disconnected_hotspot():
    """An isolated node, out of the cluster's radius, needs its own waypoint."""
    nodes = [
        GraphNode(
            node_id="a1",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="a2",
            location=GeoPoint(coordinates=(1.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="a3",
            location=GeoPoint(coordinates=(2.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="b1",
            location=GeoPoint(coordinates=(50.0, 50.0)),
            risk_score=0.9,
        ),
    ]
    edges = [
        GraphEdge(
            "a1",
            "a2",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
        GraphEdge(
            "a2",
            "a1",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
        GraphEdge(
            "a2",
            "a3",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
        GraphEdge(
            "a3",
            "a2",
            distance_km=1.0,
            est_time_min=3.0,
            est_fuel_l=0.15,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=edges)

    assert route_planner.select_waypoints(graph) == ["a2", "b1"]


def test_select_waypoints_respects_threshold():
    graph = make_line_graph()

    assert route_planner.select_waypoints(graph, threshold=0.5) == ["p3"]

    # p3 and p4 both clear the lower threshold, but p3's radius already
    # reaches p4, so one waypoint still covers both.
    lower_threshold_result = route_planner.select_waypoints(
        graph,
        threshold=0.3,
    )
    assert len(lower_threshold_result) == 1
    assert route_planner.covered_nodes(graph, lower_threshold_result) >= {
        "p3",
        "p4",
    }


def test_select_waypoints_returns_empty_when_no_high_risk_nodes():
    fixture = make_graph()
    graph = ParkGraph(
        park_id=fixture.graph.park_id,
        nodes=[
            GraphNode(node_id=n.node_id, location=n.location, risk_score=0.1)
            for n in fixture.graph.nodes
        ],
        edges=fixture.graph.edges,
    )

    assert route_planner.select_waypoints(graph) == []


# build_waypoint_distance_matrix


def test_build_waypoint_distance_matrix_covers_every_ordered_pair():
    graph = make_line_graph()

    matrix = route_planner.build_waypoint_distance_matrix(
        graph,
        ["p1", "p3", "p5"],
    )

    assert matrix[("p1", "p3")].time_min == pytest.approx(6.0)
    assert matrix[("p1", "p3")].fuel_l == pytest.approx(0.3)
    assert matrix[("p1", "p3")].path == ["p1", "p2", "p3"]
    assert matrix[("p3", "p1")].path == ["p3", "p2", "p1"]
    assert matrix[("p3", "p5")].time_min == pytest.approx(6.0)
    assert matrix[("p1", "p5")].time_min == pytest.approx(12.0)


def test_build_waypoint_distance_matrix_excludes_self_pairs():
    graph = make_line_graph()

    matrix = route_planner.build_waypoint_distance_matrix(graph, ["p1", "p2"])

    assert ("p1", "p1") not in matrix
    assert ("p2", "p2") not in matrix


def test_build_waypoint_distance_matrix_omits_unreachable_pairs():
    nodes = [
        GraphNode(
            node_id="a",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.0,
        ),
        GraphNode(
            node_id="b",
            location=GeoPoint(coordinates=(1.0, 0.0)),
            risk_score=0.0,
        ),
        GraphNode(
            node_id="isolated",
            location=GeoPoint(coordinates=(9.0, 9.0)),
            risk_score=0.0,
        ),
    ]
    edges = [
        GraphEdge("a", "b", distance_km=1.0, est_time_min=1.0, est_fuel_l=0.1),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=edges)

    matrix = route_planner.build_waypoint_distance_matrix(
        graph,
        ["a", "b", "isolated"],
    )

    assert ("a", "isolated") not in matrix
    assert ("isolated", "a") not in matrix
    assert matrix[("a", "b")].time_min == pytest.approx(1.0)


# Check if init uses tau max
def test_init_pheromones():
    fixture = make_graph()
    config = route_planner.ACOConfig(tau_max=4.2)
    matrix = route_planner.build_waypoint_distance_matrix(
        fixture.graph,
        ["start", "mid", "end"],
    )

    pheromones = route_planner.init_pheromones(matrix, config)

    assert pheromones.keys() == {
        ("start", "mid"),
        ("mid", "end"),
        ("start", "end"),
    }
    assert pheromones[("start", "mid")] == pytest.approx(4.2)
    assert pheromones[("mid", "end")] == pytest.approx(4.2)
    assert pheromones[("start", "end")] == pytest.approx(4.2)


# feasible_waypoints


def test_feasible_waypoints_filters_visited_and_infeasible():
    matrix = {
        ("start", "w1"): PathResult(
            time_min=5.0,
            fuel_l=1.0,
            path=["start", "w1"],
        ),
        ("w1", "end"): PathResult(time_min=5.0, fuel_l=1.0, path=["w1", "end"]),
        # too expensive to even reach
        ("start", "w2"): PathResult(
            time_min=100.0,
            fuel_l=1.0,
            path=["start", "w2"],
        ),
        ("w2", "end"): PathResult(time_min=5.0, fuel_l=1.0, path=["w2", "end"]),
        ("start", "end"): PathResult(
            time_min=8.0,
            fuel_l=1.0,
            path=["start", "end"],
        ),
    }

    candidates = route_planner.feasible_waypoints(
        matrix,
        waypoint_ids=["w1", "w2"],
        current_node="start",
        end_node_id="end",
        visited={"start"},
        time_remaining=20.0,
        fuel_remaining=5.0,
    )

    assert candidates == ["w1", "end"]


def test_feasible_waypoints_excludes_already_visited():
    matrix = {
        ("start", "w1"): PathResult(
            time_min=5.0,
            fuel_l=1.0,
            path=["start", "w1"],
        ),
        ("w1", "end"): PathResult(time_min=5.0, fuel_l=1.0, path=["w1", "end"]),
    }

    candidates = route_planner.feasible_waypoints(
        matrix,
        waypoint_ids=["w1"],
        current_node="start",
        end_node_id="end",
        visited={"start", "w1"},
        time_remaining=20.0,
        fuel_remaining=5.0,
    )

    assert candidates == []


def test_feasible_waypoints_excludes_when_return_trip_unaffordable():
    """Reachable directly, but the return trip would strand the tour."""
    matrix = {
        ("start", "w1"): PathResult(
            time_min=5.0,
            fuel_l=1.0,
            path=["start", "w1"],
        ),
        ("w1", "end"): PathResult(
            time_min=50.0,
            fuel_l=1.0,
            path=["w1", "end"],
        ),
    }

    candidates = route_planner.feasible_waypoints(
        matrix,
        waypoint_ids=["w1"],
        current_node="start",
        end_node_id="end",
        visited=set(),
        time_remaining=20.0,
        fuel_remaining=5.0,
    )

    assert candidates == []


def test_feasible_waypoints_excludes_unreachable_targets():
    candidates = route_planner.feasible_waypoints(
        {},
        waypoint_ids=["w1"],
        current_node="start",
        end_node_id="end",
        visited=set(),
        time_remaining=20.0,
        fuel_remaining=5.0,
    )

    assert candidates == []


# select_next_waypoint


def test_select_next_waypoint_returns_none_when_no_candidates():
    config = route_planner.ACOConfig()

    assert (
        route_planner.select_next_waypoint(
            [],
            {},
            {},
            "start",
            {},
            config,
            random.Random(0),
        )
        is None
    )


def test_select_next_waypoint_discounts_already_covered_candidates():
    """An already-covered candidate stops pulling the search toward it."""
    config = route_planner.ACOConfig(alpha=1.0, beta=1.0)
    matrix = {
        ("start", "w1"): PathResult(
            time_min=10.0,
            fuel_l=1.5,
            path=["start", "w1"],
        ),
        ("start", "w2"): PathResult(
            time_min=25.0,
            fuel_l=3.5,
            path=["start", "w2"],
        ),
    }
    node_risk = {"w1": 0.7, "w2": 0.4}
    pheromones = {("start", "w1"): 1.0, ("start", "w2"): 1.0}
    # Lands inside w1's share of the roulette wheel while uncovered.
    rng = FixedRandom(fraction=0.01)

    uncovered_choice = route_planner.select_next_waypoint(
        ["w1", "w2"],
        pheromones,
        matrix,
        "start",
        node_risk,
        config,
        rng,
    )
    assert uncovered_choice == "w1"

    covered_choice = route_planner.select_next_waypoint(
        ["w1", "w2"],
        pheromones,
        matrix,
        "start",
        node_risk,
        config,
        rng,
        covered=frozenset({"w1"}),
    )
    assert covered_choice == "w2"


def test_select_next_waypoint_falls_back_to_random_when_weights_are_zero():
    """
    Zero pheromone with alpha > 0 zeroes every weight.

    Forcing the uniform-random fallback rather than a division by zero.
    """
    config = route_planner.ACOConfig(alpha=1.0, beta=1.0, tau_min=0.0)
    matrix = {
        ("start", "w1"): PathResult(
            time_min=10.0,
            fuel_l=1.5,
            path=["start", "w1"],
        ),
    }
    node_risk = {"w1": 0.7}

    choice = route_planner.select_next_waypoint(
        ["w1"],
        {},
        matrix,
        "start",
        node_risk,
        config,
        FixedRandom(),
    )
    assert choice == "w1"


# construct_waypoint_tour


def test_construct_waypoint_tour_builds_waypoint_and_expanded_paths(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig()
    matrix = {
        ("start", "mid"): PathResult(
            time_min=10.0,
            fuel_l=1.5,
            path=["start", "mid"],
        ),
        ("mid", "end"): PathResult(
            time_min=10.0,
            fuel_l=1.5,
            path=["mid", "end"],
        ),
    }
    feasible_calls = iter([["mid"], ["end"]])

    monkeypatch.setattr(
        route_planner,
        "feasible_waypoints",
        lambda *args, **kwargs: next(feasible_calls),
    )
    monkeypatch.setattr(
        route_planner,
        "select_next_waypoint",
        lambda candidates, *_, **__: candidates[0],
    )

    waypoint_path, expanded_path, time_used, fuel_used, risk_total = (
        route_planner.construct_waypoint_tour(
            fixture.graph,
            matrix,
            waypoint_ids=["mid"],
            start_node_id="start",
            end_node_id="end",
            max_time=30.0,
            max_fuel=5.0,
            pheromones={},
            config=config,
            rng=random.Random(0),
        )
    )

    assert waypoint_path == ["start", "mid", "end"]
    assert expanded_path == ["start", "mid", "end"]
    assert time_used == pytest.approx(20.0)
    assert fuel_used == pytest.approx(3.0)


def test_construct_waypoint_tour_discounts_risk_for_already_covered_nodes():
    """Fitness must track real coverage gain, not raw cells touched.

    p3's risk is credited on the first hop (passing p2, adjacent to it),
    and p4 is credited on that same hop too since p3's radius reaches it,
    so neither contributes again on the second hop.
    """
    graph = make_line_graph()
    config = route_planner.ACOConfig()
    matrix = {
        ("p1", "p3"): PathResult(
            time_min=6.0,
            fuel_l=0.3,
            path=["p1", "p2", "p3"],
        ),
        ("p3", "p5"): PathResult(
            time_min=6.0,
            fuel_l=0.3,
            path=["p3", "p4", "p5"],
        ),
    }

    waypoint_path, expanded_path, time_used, fuel_used, risk_total = (
        route_planner.construct_waypoint_tour(
            graph,
            matrix,
            waypoint_ids=["p3"],
            start_node_id="p1",
            end_node_id="p5",
            max_time=100.0,
            max_fuel=10.0,
            pheromones={},
            config=config,
            rng=random.Random(0),
        )
    )

    assert waypoint_path == ["p1", "p3", "p5"]
    assert expanded_path == ["p1", "p2", "p3", "p4", "p5"]
    assert time_used == pytest.approx(12.0)
    assert fuel_used == pytest.approx(0.6)
    assert risk_total == pytest.approx(1.3)


def test_construct_waypoint_tour_treats_none_max_time_and_max_fuel_as_unlimited(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig()
    captured = {}

    def fake_feasible_waypoints(
        distance_matrix,
        waypoint_ids,
        current_node,
        end_node_id,
        visited,
        time_remaining,
        fuel_remaining,
    ):
        captured["time_remaining"] = time_remaining
        captured["fuel_remaining"] = fuel_remaining
        return []

    monkeypatch.setattr(
        route_planner,
        "feasible_waypoints",
        fake_feasible_waypoints,
    )
    monkeypatch.setattr(
        route_planner,
        "select_next_waypoint",
        lambda *args, **kwargs: None,
    )

    route_planner.construct_waypoint_tour(
        fixture.graph,
        {},
        waypoint_ids=["mid"],
        start_node_id="start",
        end_node_id="end",
        max_time=None,
        max_fuel=None,
        pheromones={},
        config=config,
        rng=random.Random(0),
    )

    assert captured["time_remaining"] == math.inf
    assert captured["fuel_remaining"] == math.inf


def test_construct_waypoint_tour_stops_when_no_feasible_waypoint_exists(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig()

    monkeypatch.setattr(
        route_planner,
        "feasible_waypoints",
        lambda *a, **k: [],
    )
    monkeypatch.setattr(
        route_planner,
        "select_next_waypoint",
        lambda *a, **k: None,
    )

    waypoint_path, expanded_path, time_used, fuel_used, risk_total = (
        route_planner.construct_waypoint_tour(
            fixture.graph,
            {},
            waypoint_ids=["mid"],
            start_node_id="start",
            end_node_id="end",
            max_time=30.0,
            max_fuel=5.0,
            pheromones={},
            config=config,
            rng=random.Random(0),
        )
    )

    assert waypoint_path == ["start"]
    assert expanded_path == ["start"]
    assert time_used == pytest.approx(0.0)
    assert fuel_used == pytest.approx(0.0)
    assert risk_total == pytest.approx(0.0)


# decays
def test_update_pheromones():
    fixture = make_graph()
    config = route_planner.ACOConfig(rho=0.1, tau_min=0.01, tau_max=1.0)
    matrix = route_planner.build_waypoint_distance_matrix(
        fixture.graph,
        ["start", "mid", "end"],
    )
    pheromones = route_planner.init_pheromones(matrix, config)

    updated = route_planner.update_pheromones(
        pheromones,
        best_path=[
            fixture.start_node_id,
            fixture.mid_node_id,
            fixture.end_node_id,
        ],
        best_score=0.5,
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


def test_run_phase_returns_best(
    monkeypatch,
):
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=2)
    calls = []

    def fake_construct_waypoint_tour(*args, **kwargs):
        return (
            [fixture.start_node_id, fixture.mid_node_id, fixture.end_node_id],
            [fixture.start_node_id, fixture.mid_node_id, fixture.end_node_id],
            20.0,
            3.0,
            0.8,
        )

    def fake_update_pheromones(pheromones, best_path, best_score, config):
        calls.append((best_path, best_score))
        return {"updated": True}

    monkeypatch.setattr(
        route_planner,
        "construct_waypoint_tour",
        fake_construct_waypoint_tour,
    )
    monkeypatch.setattr(
        route_planner,
        "update_pheromones",
        fake_update_pheromones,
    )

    best_waypoint_path, best_expanded_path, best_risk, pheromones = (
        route_planner.run_phase(
            fixture.graph,
            {},
            ["mid"],
            fixture.start_node_id,
            fixture.end_node_id,
            max_time=30.0,
            max_fuel=5.0,
            pheromones={"initial": True},
            num_iterations=3,
            config=config,
            rng=random.Random(0),
        )
    )

    assert best_waypoint_path == ["start", "mid", "end"]
    assert best_expanded_path == ["start", "mid", "end"]
    assert best_risk == pytest.approx(0.8)
    assert pheromones == {"updated": True}
    # 0.8 risk less 0.1 * 20.0 minutes, deposited once per iteration
    assert calls == [(["start", "mid", "end"], pytest.approx(-1.2))] * 3


def test_run_phase_prefers_cheap_tour_when_extra_risk_costs_too_much(
    monkeypatch,
):
    """45 extra minutes for 0.05 more risk is a bad trade at risk_weight 0.1."""
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=2, risk_weight=0.1)
    tour_path = [
        fixture.start_node_id,
        fixture.mid_node_id,
        fixture.end_node_id,
    ]

    short_tour = (tour_path, tour_path, 5.0, 1.0, 1.0)
    long_tour = (tour_path, tour_path, 50.0, 10.0, 1.05)
    responses = iter([short_tour, long_tour])

    monkeypatch.setattr(
        route_planner,
        "construct_waypoint_tour",
        lambda *args, **kwargs: next(responses),
    )
    deposits = []
    monkeypatch.setattr(
        route_planner,
        "update_pheromones",
        lambda pheromones, best_path, best_score, config: (
            deposits.append(best_score) or pheromones
        ),
    )

    best_waypoint_path, best_expanded_path, best_risk, _ = (
        route_planner.run_phase(
            fixture.graph,
            {},
            ["mid"],
            fixture.start_node_id,
            fixture.end_node_id,
            max_time=60.0,
            max_fuel=15.0,
            pheromones={},
            num_iterations=1,
            config=config,
            rng=random.Random(0),
        )
    )

    assert best_risk == pytest.approx(1.0)
    # 1.0 risk less 0.1 * 5.0 minutes
    assert deposits == [pytest.approx(0.5)]


def test_run_phase_skips_iterations_without_complete_tours(monkeypatch):
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=2)
    incomplete_path = [fixture.start_node_id, fixture.mid_node_id]

    monkeypatch.setattr(
        route_planner,
        "construct_waypoint_tour",
        lambda *args, **kwargs: (
            incomplete_path,
            incomplete_path,
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

    best_waypoint_path, best_expanded_path, best_risk, pheromones = (
        route_planner.run_phase(
            fixture.graph,
            {},
            ["mid"],
            fixture.start_node_id,
            fixture.end_node_id,
            max_time=30.0,
            max_fuel=5.0,
            pheromones={"initial": True},
            num_iterations=2,
            config=config,
            rng=random.Random(0),
        )
    )

    assert best_waypoint_path == []
    assert best_expanded_path == []
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
    assert route.estimated_time_min == pytest.approx(20.0)
    assert route.estimated_fuel_l == pytest.approx(3.0)
    assert route.risk_coverage == pytest.approx(0.83)
    assert route.path_geometry.type == "LineString"
    assert len(route.path_geometry.coordinates) >= 2


def test_compute_risk_coverage_all_high_risk_nodes_visited():
    """make_graph()'s only >=0.5 node is 'mid'; this path visits it."""
    fixture = make_graph()
    coverage = route_planner.compute_risk_coverage(
        fixture.graph,
        path=["start", "mid", "end"],
    )
    assert coverage == pytest.approx(1.0)


def test_compute_risk_coverage_no_high_risk_nodes_within_coverage_radius():
    """p3 (0.9) is 2 hops from p1 - too far to count as covered."""
    graph = make_line_graph()
    coverage = route_planner.compute_risk_coverage(graph, path=["p1"])
    assert coverage == pytest.approx(0.0)


def test_compute_risk_coverage_counts_high_risk_neighbor_within_one_hop():
    """p3 (0.9) is adjacent to p2 - covered without being on the path."""
    graph = make_line_graph()
    coverage = route_planner.compute_risk_coverage(graph, path=["p2"])
    assert coverage == pytest.approx(1.0)


def test_compute_risk_coverage_returns_zero_when_grid_has_no_high_risk_cells():
    """A uniformly low-risk grid has no hotspots to cover."""
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(float(i), 0.0)),
            risk_score=0.1,
        )
        for i, nid in enumerate(("a", "b"))
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=[])
    coverage = route_planner.compute_risk_coverage(graph, path=["a", "b"])
    assert coverage == pytest.approx(0.0)


def test_compute_risk_coverage_scores_against_the_dim_grids_own_top():
    """Below the absolute cut, the grid's top cells become the hotspots."""
    nodes = [
        GraphNode(
            node_id="a",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.1,
        ),
        GraphNode(
            node_id="b",
            location=GeoPoint(coordinates=(1.0, 1.0)),
            risk_score=0.2,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=[])

    assert route_planner.compute_risk_coverage(
        graph, path=["b"],
    ) == pytest.approx(1.0)
    assert route_planner.compute_risk_coverage(
        graph, path=["a"],
    ) == pytest.approx(0.0)


def test_compute_risk_coverage_partial_ratio():
    nodes = [
        GraphNode(
            node_id="a",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.9,
        ),
        GraphNode(
            node_id="b",
            location=GeoPoint(coordinates=(1.0, 1.0)),
            risk_score=0.8,
        ),
        GraphNode(
            node_id="c",
            location=GeoPoint(coordinates=(2.0, 2.0)),
            risk_score=0.1,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=[])
    coverage = route_planner.compute_risk_coverage(graph, path=["a", "c"])
    assert coverage == pytest.approx(0.5)


def test_compute_risk_coverage_respects_custom_threshold():
    """A lower threshold pulls p4 into the high-risk set too.

    Dropping coverage from 1.0 (only p3 counts) to 0.5 (p3 covered, p4 not).
    """
    graph = make_line_graph()
    coverage_default = route_planner.compute_risk_coverage(
        graph,
        path=["p2"],
        threshold=0.5,
    )
    coverage_lower = route_planner.compute_risk_coverage(
        graph,
        path=["p2"],
        threshold=0.3,
    )
    assert coverage_default == pytest.approx(1.0)
    assert coverage_lower == pytest.approx(0.5)


def test_plan_routes_uses_normalized_coverage_not_raw_search_sum(monkeypatch):
    """Final risk_coverage must be normalized, not run_phase's raw sum."""
    fixture = make_graph()
    config = route_planner.ACOConfig(
        total_iterations=10,
        phase_split=(1.0, 0.0, 0.0),
    )
    tour_path = ["start", "mid", "end"]

    monkeypatch.setattr(
        route_planner,
        "run_phase",
        lambda *args, **kwargs: (tour_path, tour_path, 999.0, {}),
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

    assert len(routes) == 1
    assert routes[0].risk_coverage == pytest.approx(1.0)


def test_is_sufficiently_diverse_rejects_too_similar_paths():
    candidate = ["start", "mid", "end"]
    prior_paths = [["start", "mid", "end"]]

    assert (
        route_planner.is_sufficiently_diverse(
            candidate,
            prior_paths,
            threshold=0.3,
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
        total_iterations=10,
        phase_split=(0.5, 0.5, 0.0),
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
        return path, path, risk, {}

    monkeypatch.setattr(route_planner, "run_phase", fake_run_phase)
    monkeypatch.setattr(
        route_planner,
        "apply_partial_penalty",
        lambda pheromones, used_path, config: (
            penalty_calls.append(used_path) or pheromones
        ),
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
        total_iterations=10,
        phase_split=(1.0, 0.0, 0.0),
    )

    monkeypatch.setattr(
        route_planner,
        "run_phase",
        lambda *args, **kwargs: ([], [], 0.0, {}),
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


# determinism


def _seeded_plan(graph, fixture, seed, **overrides):
    config = route_planner.ACOConfig(
        num_ants=4,
        total_iterations=12,
        seed=seed,
        **overrides,
    )
    return route_planner.plan_routes(
        graph,
        fixture.start_node_id,
        fixture.end_node_id,
        max_time_min=None,
        max_fuel_l=None,
        num_alternatives=3,
        config=config,
    )


def _signature(routes):
    return [(r.suggested_path, round(r.risk_coverage, 9)) for r in routes]


def test_plan_routes_is_reproducible_for_a_fixed_seed():
    fixture = make_graph()
    first = _seeded_plan(fixture.graph, fixture, seed=1234)
    second = _seeded_plan(fixture.graph, fixture, seed=1234)
    assert _signature(first) == _signature(second)


def test_plan_routes_rebuilds_the_stream_on_every_call():
    """A second call with one config must not continue the first's stream."""
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=4, total_iterations=12, seed=7)
    args = (fixture.graph, fixture.start_node_id, fixture.end_node_id)
    first = route_planner.plan_routes(*args, None, None, 3, config)
    second = route_planner.plan_routes(*args, None, None, 3, config)
    assert _signature(first) == _signature(second)


def test_plan_routes_seed_survives_a_fresh_equivalent_graph():
    """Reproducibility must not depend on the graph object's warm caches."""
    fixture = make_graph()
    first = _seeded_plan(fixture.graph, fixture, seed=99)
    rebuilt = make_graph()
    second = _seeded_plan(rebuilt.graph, rebuilt, seed=99)
    assert _signature(first) == _signature(second)


def test_plan_routes_without_a_seed_still_plans():
    fixture = make_graph()
    routes = _seeded_plan(fixture.graph, fixture, seed=None)
    assert all(isinstance(r, PlannedRoute) for r in routes)


def test_aco_config_defaults_to_no_seed():
    assert route_planner.ACOConfig().seed is None


def test_select_waypoints_order_does_not_depend_on_set_iteration():
    """Equally good candidates must resolve in grid order, not hash order.

    Every cell here covers exactly one uncovered high-risk cell on the first
    pass, so the winner is decided purely by tie-break.
    """
    node_ids = [f"cell-{i}" for i in range(12)]
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(float(i), 0.0)),
            risk_score=0.9,
        )
        for i, nid in enumerate(node_ids)
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=[])

    assert route_planner.select_waypoints(graph) == node_ids


def test_select_waypoints_follows_node_order_not_insertion_luck():
    """Reversing the node list reverses the result, proving order is read."""
    node_ids = [f"cell-{i}" for i in range(12)]
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(float(i), 0.0)),
            risk_score=0.9,
        )
        for i, nid in enumerate(node_ids)
    ]
    reversed_graph = ParkGraph(park_id="p", nodes=nodes[::-1], edges=[])

    assert route_planner.select_waypoints(reversed_graph) == node_ids[::-1]


# degenerate routes


def test_is_sufficiently_diverse_rejects_an_edgeless_candidate():
    assert not route_planner.is_sufficiently_diverse(["a"], [], 0.3)


def test_is_sufficiently_diverse_rejects_two_identical_single_nodes():
    assert not route_planner.is_sufficiently_diverse(["a"], [["a"]], 0.3)


def test_is_sufficiently_diverse_still_accepts_a_real_first_path():
    assert route_planner.is_sufficiently_diverse(["a", "b"], [], 0.3)


def _round_trip_graph() -> ParkGraph:
    """p1 - p2 - p3 in a line, p2 carries the risk worth patrolling."""
    risks = {"p1": 0.0, "p2": 0.9, "p3": 0.9}
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(float(i), 0.0)),
            risk_score=risks[nid],
        )
        for i, nid in enumerate(("p1", "p2", "p3"))
    ]
    edges = []
    for a, b in (("p1", "p2"), ("p2", "p3")):
        edges.append(GraphEdge(a, b, 1.0, 3.0, 0.15))
        edges.append(GraphEdge(b, a, 1.0, 3.0, 0.15))
    return ParkGraph(park_id="rt", nodes=nodes, edges=edges)


def test_plan_routes_returns_a_real_loop_when_start_equals_end():
    graph = _round_trip_graph()
    config = route_planner.ACOConfig(num_ants=6, total_iterations=15, seed=5)
    routes = route_planner.plan_routes(
        graph, "p1", "p1", None, None, 3, config,
    )

    assert routes
    for route in routes:
        assert len(route.suggested_path) > 1
        assert route.suggested_path[0] == "p1"
        assert route.suggested_path[-1] == "p1"
        assert route.estimated_time_min > 0


def test_plan_routes_never_emits_a_single_point_geometry():
    graph = _round_trip_graph()
    config = route_planner.ACOConfig(num_ants=6, total_iterations=15, seed=5)
    routes = route_planner.plan_routes(
        graph, "p1", "p1", None, None, 3, config,
    )

    assert all(len(r.path_geometry.coordinates) > 1 for r in routes)


def test_plan_routes_drops_a_loop_with_nowhere_to_go():
    """No reachable waypoint means no patrol, not a zero length route."""
    nodes = [
        GraphNode(
            node_id="solo",
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.9,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=[])
    config = route_planner.ACOConfig(num_ants=2, total_iterations=4, seed=1)

    assert (
        route_planner.plan_routes(
            graph, "solo", "solo", None, None, 3, config,
        )
        == []
    )


def test_plan_routes_start_to_end_is_unchanged_by_the_loop_handling():
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=4, total_iterations=12, seed=3)
    routes = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        None,
        None,
        3,
        config,
    )

    for route in routes:
        assert route.suggested_path[0] == fixture.start_node_id
        assert route.suggested_path[-1] == fixture.end_node_id


# tour_score


def test_tour_score_charges_time_against_risk():
    assert route_planner.tour_score(10.0, 20.0, 0.1) == pytest.approx(8.0)


def test_tour_score_goes_negative_when_time_outweighs_risk():
    assert route_planner.tour_score(1.0, 100.0, 0.1) == pytest.approx(-9.0)


def test_tour_score_ignores_time_at_zero_weight():
    assert route_planner.tour_score(5.0, 999.0, 0.0) == pytest.approx(5.0)


def test_tour_score_prefers_more_coverage_at_equal_time():
    cheap = route_planner.tour_score(4.0, 50.0, 0.1)
    rich = route_planner.tour_score(9.0, 50.0, 0.1)
    assert rich > cheap


def test_tour_score_prefers_the_shorter_of_two_equal_risk_tours():
    short = route_planner.tour_score(6.0, 30.0, 0.1)
    long_ = route_planner.tour_score(6.0, 300.0, 0.1)
    assert short > long_


def test_higher_risk_weight_flips_the_winner():
    """The same pair of tours ranks differently as time gets pricier."""
    thorough = (20.0, 200.0)
    quick = (8.0, 30.0)
    assert route_planner.tour_score(*thorough, 0.01) > route_planner.tour_score(
        *quick, 0.01,
    )
    assert route_planner.tour_score(*quick, 0.5) > route_planner.tour_score(
        *thorough, 0.5,
    )


def test_update_pheromones_ignores_a_negative_score():
    config = route_planner.ACOConfig(rho=0.1, tau_min=0.01, tau_max=5.0)
    pheromones = {("a", "b"): 1.0}

    updated = route_planner.update_pheromones(
        pheromones, ["a", "b"], -50.0, config,
    )

    assert updated[("a", "b")] == pytest.approx(0.9)


# coverage_target


def _coverage_graph(size: int = 9) -> ParkGraph:
    """Build a line of high-risk cells, so coverage scales with length."""
    nodes = [
        GraphNode(
            node_id=f"c{i}",
            location=GeoPoint(coordinates=(float(i) * 0.01, 0.0)),
            risk_score=0.9,
        )
        for i in range(size)
    ]
    edges = []
    for i in range(size - 1):
        edges.append(GraphEdge(f"c{i}", f"c{i + 1}", 1.0, 3.0, 0.15))
        edges.append(GraphEdge(f"c{i + 1}", f"c{i}", 1.0, 3.0, 0.15))
    return ParkGraph(park_id="line", nodes=nodes, edges=edges)


def _plan(graph, **config_kwargs):
    config = route_planner.ACOConfig(
        num_ants=6,
        total_iterations=20,
        probe_iterations=4,
        seed=17,
        **config_kwargs,
    )
    return route_planner.plan_routes(
        graph, "c0", "c8", None, None, 1, config,
    )


def test_a_low_risk_weight_buys_more_coverage_than_a_high_one():
    graph = _coverage_graph()
    greedy = _plan(graph, risk_weight=0.001)
    stingy = _plan(graph, risk_weight=5.0)
    assert greedy[0].risk_coverage >= stingy[0].risk_coverage


def test_solve_risk_weight_stays_inside_its_bounds():
    graph = _coverage_graph()
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=8, probe_iterations=3,
        seed=2, coverage_target=0.9,
    )
    waypoints = route_planner.select_waypoints(graph)
    hubs = list(dict.fromkeys(["c0", "c8", *waypoints]))
    matrix = route_planner.build_waypoint_distance_matrix(graph, hubs)

    weight = route_planner.solve_risk_weight(
        graph, matrix, waypoints, "c0", "c8", None, None,
        config, random.Random(0),
    )

    assert weight >= route_planner.RISK_WEIGHT_MIN
    assert weight <= route_planner.RISK_WEIGHT_MAX


def test_an_unreachable_coverage_target_falls_back_to_the_cheapest_weight():
    graph = _coverage_graph()
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=8, probe_iterations=3,
        seed=2, coverage_target=1.1,
    )
    waypoints = route_planner.select_waypoints(graph)
    hubs = list(dict.fromkeys(["c0", "c8", *waypoints]))
    matrix = route_planner.build_waypoint_distance_matrix(graph, hubs)

    weight = route_planner.solve_risk_weight(
        graph, matrix, waypoints, "c0", "c8", None, None,
        config, random.Random(0),
    )

    assert weight == route_planner.RISK_WEIGHT_MIN


def test_coverage_target_reaches_further_than_a_blunt_high_risk_weight():
    graph = _coverage_graph()
    targeted = _plan(graph, risk_weight=5.0, coverage_target=0.95)
    untargeted = _plan(graph, risk_weight=5.0)
    assert targeted[0].risk_coverage >= untargeted[0].risk_coverage


def test_coverage_target_is_ignored_when_there_are_no_waypoints():
    """No high-risk cells means nothing to bisect against."""
    nodes = [
        GraphNode(
            node_id=f"c{i}",
            location=GeoPoint(coordinates=(float(i) * 0.01, 0.0)),
            risk_score=0.0,
        )
        for i in range(3)
    ]
    edges = []
    for i in range(2):
        edges.append(GraphEdge(f"c{i}", f"c{i + 1}", 1.0, 3.0, 0.15))
        edges.append(GraphEdge(f"c{i + 1}", f"c{i}", 1.0, 3.0, 0.15))
    graph = ParkGraph(park_id="flat", nodes=nodes, edges=edges)
    config = route_planner.ACOConfig(
        num_ants=2, total_iterations=4, seed=1, coverage_target=0.9,
    )

    routes = route_planner.plan_routes(
        graph, "c0", "c2", None, None, 1, config,
    )

    assert [r.suggested_path for r in routes] == [["c0", "c1", "c2"]]
    assert routes[0].risk_coverage == 0.0


def test_planning_stays_reproducible_with_a_coverage_target():
    graph = _coverage_graph()
    first = _plan(graph, coverage_target=0.8)
    second = _plan(graph, coverage_target=0.8)
    assert [r.suggested_path for r in first] == [
        r.suggested_path for r in second
    ]


# high_risk_threshold


def _risk_graph(scores: list[float]) -> ParkGraph:
    nodes = [
        GraphNode(
            node_id=f"c{i}",
            location=GeoPoint(coordinates=(float(i) * 0.01, 0.0)),
            risk_score=score,
        )
        for i, score in enumerate(scores)
    ]
    return ParkGraph(park_id="p", nodes=nodes, edges=[])


def test_threshold_keeps_the_absolute_cut_when_something_clears_it():
    graph = _risk_graph([0.1, 0.4, 0.9])
    assert route_planner.high_risk_threshold(graph) == pytest.approx(0.5)


def test_threshold_drops_to_the_quantile_on_a_dim_heatmap():
    graph = _risk_graph([0.0, 0.05, 0.1, 0.2, 0.3, 0.45])
    threshold = route_planner.high_risk_threshold(graph)
    assert threshold < route_planner.DEFAULT_HIGH_RISK_THRESHOLD
    assert threshold > 0.0


def test_threshold_finds_hotspots_a_fixed_cut_would_have_missed():
    graph = _risk_graph([0.0, 0.05, 0.1, 0.2, 0.3, 0.45])
    assert route_planner.select_waypoints(graph) != []
    assert route_planner.select_waypoints(graph, threshold=0.5) == []


def test_threshold_ignores_a_flat_heatmap():
    """No spread means no top, whatever the level."""
    for level in (0.0, 0.1, 0.3, 0.49):
        graph = _risk_graph([level] * 8)
        assert route_planner.high_risk_threshold(graph) == pytest.approx(0.5)
        assert route_planner.select_waypoints(graph) == []


def test_threshold_respects_the_floor_on_a_near_zero_heatmap():
    graph = _risk_graph([0.0, 0.0, 0.0, 0.001, 0.002])
    assert route_planner.high_risk_threshold(graph) == pytest.approx(0.5)


def test_threshold_is_cached_on_the_graph():
    graph = _risk_graph([0.1, 0.2, 0.3])
    first = route_planner.high_risk_threshold(graph)
    assert route_planner.high_risk_threshold(graph) == first
    assert graph._high_risk_threshold_cache == first


def test_threshold_handles_an_empty_grid():
    graph = ParkGraph(park_id="p", nodes=[], edges=[])
    assert route_planner.high_risk_threshold(graph) == pytest.approx(0.5)


# select_waypoints cost weighting and cap


def _two_cluster_graph() -> ParkGraph:
    """Two tight hotspot clusters, far apart, with nothing in between."""
    nodes = []
    for i in range(3):
        nodes.append(
            GraphNode(
                node_id=f"near{i}",
                location=GeoPoint(coordinates=(31.0 + i * 0.2, -24.0)),
                risk_score=0.9,
            ),
        )
    for i in range(3):
        nodes.append(
            GraphNode(
                node_id=f"far{i}",
                location=GeoPoint(coordinates=(33.0 + i * 0.2, -24.0)),
                risk_score=0.9,
            ),
        )
    return ParkGraph(park_id="p", nodes=nodes, edges=[])


def test_select_waypoints_finishes_a_cluster_before_crossing_the_park():
    graph = _two_cluster_graph()
    picked = route_planner.select_waypoints(graph)
    first_group = [nid[:-1] for nid in picked[:3]]
    assert len(set(first_group)) == 1


def test_select_waypoints_still_covers_every_cluster():
    graph = _two_cluster_graph()
    picked = set(route_planner.select_waypoints(graph))
    assert any(nid.startswith("near") for nid in picked)
    assert any(nid.startswith("far") for nid in picked)


def test_select_waypoints_honours_the_limit():
    graph = _two_cluster_graph()
    assert len(route_planner.select_waypoints(graph, limit=2)) == 2
    assert len(route_planner.select_waypoints(graph, limit=1)) == 1


def test_select_waypoints_limit_above_the_need_changes_nothing():
    graph = _two_cluster_graph()
    assert route_planner.select_waypoints(
        graph, limit=99,
    ) == route_planner.select_waypoints(graph)


def test_select_waypoints_limit_of_zero_returns_nothing():
    graph = _two_cluster_graph()
    assert route_planner.select_waypoints(graph, limit=0) == []


def test_plan_routes_caps_the_hubs_it_searches():
    graph = _two_cluster_graph()
    config = route_planner.ACOConfig(
        num_ants=2, total_iterations=4, seed=1, max_waypoints=2,
    )
    captured = []
    original = route_planner.build_waypoint_distance_matrix

    def spy(g, node_ids):
        captured.append(list(node_ids))
        return original(g, node_ids)

    route_planner.build_waypoint_distance_matrix = spy
    try:
        route_planner.plan_routes(
            graph, "near0", "far0", None, None, 1, config,
        )
    finally:
        route_planner.build_waypoint_distance_matrix = original

    # start, end, and at most max_waypoints hotspots
    assert len(captured[0]) <= 4
