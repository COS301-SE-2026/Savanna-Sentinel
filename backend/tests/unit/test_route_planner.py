"""Unit tests for the route planner.

using a small deterministic graph fixture and then test the helper
functions plus the high-level plan_routes().
"""

from __future__ import annotations

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


# stubbed phases return paths, not hub sequences, so leave them as is
KEEP_TOURS = (None, None, None)


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
        ),
        GraphEdge(
            "mid",
            "end",
            distance_km=1.0,
            est_time_min=10.0,
        ),
        GraphEdge(
            "start",
            "end",
            distance_km=2.0,
            est_time_min=25.0,
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
            ),
        )
        edges.append(
            GraphEdge(
                b,
                a,
                distance_km=1.0,
                est_time_min=3.0,
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


def _stops(graph, threshold=None):
    return [
        stop for stop, _ in route_planner.hotspot_zones(graph, threshold)
    ]




def test_hotspot_zones_splits_an_area_too_long_for_one_pass():
    graph = _coverage_graph()

    zones = route_planner.hotspot_zones(graph)

    assert len(zones) == 3
    for stop, cells in zones:
        stop_at = int(stop[1:])
        assert all(
            abs(int(c[1:]) - stop_at) <= route_planner.ZONE_RADIUS_STEPS
            for c in cells
        )
    assert sorted(c for _, cells in zones for c in cells) == sorted(
        f"c{i}" for i in range(9)
    )


def test_hotspot_zones_centres_on_the_riskiest_part():
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(float(i), 0.0)),
            risk_score=score,
        )
        for i, (nid, score) in enumerate(
            [("q0", 0.3), ("q1", 0.3), ("q2", 0.9)],
        )
    ]
    pairs = [("q0", "q1"), ("q1", "q2")]
    edges = [GraphEdge(a, b, 1.0, 3.0) for a, b in pairs] + [
        GraphEdge(b, a, 1.0, 3.0) for a, b in pairs
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=edges)

    assert route_planner.hotspot_zones(graph) == [("q2", ["q0", "q1", "q2"])]


def test_hotspot_zones_come_heaviest_first():
    graph = _risk_graph([0.3, 0.9, 0.5])

    assert _stops(graph) == ["c1", "c2", "c0"]


def test_zone_stops_covers_a_cluster_with_one_representative():
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
        ),
        GraphEdge(
            "a2",
            "a1",
            distance_km=1.0,
            est_time_min=3.0,
        ),
        GraphEdge(
            "a2",
            "a3",
            distance_km=1.0,
            est_time_min=3.0,
        ),
        GraphEdge(
            "a3",
            "a2",
            distance_km=1.0,
            est_time_min=3.0,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=edges)

    assert _stops(graph) == ["a2"]


def test_zone_stops_needs_one_per_disconnected_hotspot():
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
        ),
        GraphEdge(
            "a2",
            "a1",
            distance_km=1.0,
            est_time_min=3.0,
        ),
        GraphEdge(
            "a2",
            "a3",
            distance_km=1.0,
            est_time_min=3.0,
        ),
        GraphEdge(
            "a3",
            "a2",
            distance_km=1.0,
            est_time_min=3.0,
        ),
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=edges)

    assert _stops(graph) == ["a2", "b1"]


def test_zone_stops_respects_threshold():
    graph = make_line_graph()

    assert _stops(graph, threshold=0.5) == ["p3"]

    # p3 and p4 both clear the lower threshold, but p3's radius already
    # reaches p4, so one waypoint still covers both.
    lower_threshold_result = _stops(
        graph,
        threshold=0.3,
    )
    assert len(lower_threshold_result) == 1
    assert route_planner.covered_nodes(graph, lower_threshold_result) >= {
        "p3",
        "p4",
    }


def test_zone_stops_returns_empty_when_no_high_risk_nodes():
    fixture = make_graph()
    graph = ParkGraph(
        park_id=fixture.graph.park_id,
        nodes=[
            GraphNode(node_id=n.node_id, location=n.location, risk_score=0.1)
            for n in fixture.graph.nodes
        ],
        edges=fixture.graph.edges,
    )

    assert _stops(graph) == []


# build_waypoint_distance_matrix


def test_build_waypoint_distance_matrix_covers_every_ordered_pair():
    graph = make_line_graph()

    matrix = route_planner.build_waypoint_distance_matrix(
        graph,
        ["p1", "p3", "p5"],
    )

    assert matrix[("p1", "p3")].time_min == pytest.approx(6.0)
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
        GraphEdge("a", "b", distance_km=1.0, est_time_min=1.0),
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
            path=["start", "w1"],
        ),
        ("w1", "end"): PathResult(time_min=5.0, path=["w1", "end"]),
        # too expensive to even reach
        ("start", "w2"): PathResult(
            time_min=100.0,
            path=["start", "w2"],
        ),
        ("w2", "end"): PathResult(time_min=5.0, path=["w2", "end"]),
        ("start", "end"): PathResult(
            time_min=8.0,
            path=["start", "end"],
        ),
    }

    candidates = route_planner.feasible_waypoints(
        matrix,
        waypoint_ids=["w1", "w2"],
        current_node="start",
        end_node_id="end",
        visited={"start"},
    )

    assert candidates == ["w1", "w2", "end"]


def test_feasible_waypoints_excludes_already_visited():
    matrix = {
        ("start", "w1"): PathResult(
            time_min=5.0,
            path=["start", "w1"],
        ),
        ("w1", "end"): PathResult(time_min=5.0, path=["w1", "end"]),
    }

    candidates = route_planner.feasible_waypoints(
        matrix,
        waypoint_ids=["w1"],
        current_node="start",
        end_node_id="end",
        visited={"start", "w1"},
    )

    assert candidates == []


def test_feasible_waypoints_excludes_a_waypoint_with_no_way_back():
    """Reachable directly, but nothing leads on to the end from there."""
    matrix = {
        ("start", "w1"): PathResult(
            time_min=5.0,
            path=["start", "w1"],
        ),
        ("start", "end"): PathResult(
            time_min=8.0,
            path=["start", "end"],
        ),
    }

    candidates = route_planner.feasible_waypoints(
        matrix,
        waypoint_ids=["w1"],
        current_node="start",
        end_node_id="end",
        visited=set(),
    )

    assert candidates == ["end"]


def test_feasible_waypoints_excludes_unreachable_targets():
    candidates = route_planner.feasible_waypoints(
        {},
        waypoint_ids=["w1"],
        current_node="start",
        end_node_id="end",
        visited=set(),
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
            path=["start", "w1"],
        ),
        ("start", "w2"): PathResult(
            time_min=25.0,
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
            path=["start", "mid"],
        ),
        ("mid", "end"): PathResult(
            time_min=10.0,
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

    waypoint_path, expanded_path, time_used, risk_total = (
        route_planner.construct_waypoint_tour(
            fixture.graph,
            matrix,
            waypoint_ids=["mid"],
            start_node_id="start",
            end_node_id="end",
            pheromones={},
            config=config,
            rng=random.Random(0),
        )
    )

    assert waypoint_path == ["start", "mid", "end"]
    assert expanded_path == ["start", "mid", "end"]
    assert time_used == pytest.approx(20.0)


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
            path=["p1", "p2", "p3"],
        ),
        ("p3", "p5"): PathResult(
            time_min=6.0,
            path=["p3", "p4", "p5"],
        ),
    }

    waypoint_path, expanded_path, time_used, risk_total = (
        route_planner.construct_waypoint_tour(
            graph,
            matrix,
            waypoint_ids=["p3"],
            start_node_id="p1",
            end_node_id="p5",
            pheromones={},
            config=config,
            rng=random.Random(0),
        )
    )

    assert waypoint_path == ["p1", "p3", "p5"]
    assert expanded_path == ["p1", "p2", "p3", "p4", "p5"]
    assert time_used == pytest.approx(12.0)
    assert risk_total == pytest.approx(1.3)


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

    waypoint_path, expanded_path, time_used, risk_total = (
        route_planner.construct_waypoint_tour(
            fixture.graph,
            {},
            waypoint_ids=["mid"],
            start_node_id="start",
            end_node_id="end",
            pheromones={},
            config=config,
            rng=random.Random(0),
        )
    )

    assert waypoint_path == ["start"]
    assert expanded_path == ["start"]
    assert time_used == pytest.approx(0.0)
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

    short_tour = (tour_path, tour_path, 5.0, 1.0)
    long_tour = (tour_path, tour_path, 50.0, 1.05)
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
    assert route.distance_km == pytest.approx(2.0)
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
    coverage = route_planner.compute_risk_coverage(
        graph, path=["p2"], threshold=0.5,
    )
    assert coverage == pytest.approx(1.0)


def test_compute_risk_coverage_counts_medium_cells_by_default():
    """p4 (0.4) is shown as Medium on the map, so it must count too."""
    graph = make_line_graph()
    coverage = route_planner.compute_risk_coverage(graph, path=["p2"])
    assert coverage == pytest.approx(0.9 / 1.3)


def test_compute_risk_coverage_weights_cells_by_risk():
    graph = make_line_graph()
    near_p4_only = route_planner.compute_risk_coverage(graph, path=["p5"])
    assert near_p4_only == pytest.approx(0.4 / 1.3)


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
    assert coverage == pytest.approx(0.9 / 1.7)


def test_compute_risk_coverage_respects_custom_threshold():
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
    assert coverage_lower == pytest.approx(0.9 / 1.3)


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
        num_alternatives=1,
        config=config,
    ).routes

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


def test_plan_routes_accepts_paths_from_each_phase(monkeypatch):
    fixture = make_graph()
    config = route_planner.ACOConfig(
        total_iterations=10,
        phase_split=(0.5, 0.5, 0.0),
        coverage_tiers=KEEP_TOURS,
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
        num_alternatives=2,
        config=config,
    ).routes

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
        num_alternatives=1,
        config=config,
    ).routes

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
        num_alternatives=3,
        config=config,
    ).routes


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
    first = route_planner.plan_routes(*args, 3, config).routes
    second = route_planner.plan_routes(*args, 3, config).routes
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


def test_zone_stops_order_does_not_depend_on_set_iteration():
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

    assert _stops(graph) == node_ids


def test_zone_stops_follows_node_order_not_insertion_luck():
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

    assert _stops(reversed_graph) == node_ids[::-1]


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
        edges.append(GraphEdge(a, b, 1.0, 3.0))
        edges.append(GraphEdge(b, a, 1.0, 3.0))
    return ParkGraph(park_id="rt", nodes=nodes, edges=edges)


def test_plan_routes_returns_a_real_loop_when_start_equals_end():
    graph = _round_trip_graph()
    config = route_planner.ACOConfig(num_ants=6, total_iterations=15, seed=5)
    routes = route_planner.plan_routes(
        graph, "p1", "p1", 3, config,
    ).routes

    assert routes
    for route in routes:
        assert len(route.suggested_path) > 1
        assert route.suggested_path[0] == "p1"
        assert route.suggested_path[-1] == "p1"
        assert route.distance_km > 0


def test_plan_routes_never_emits_a_single_point_geometry():
    graph = _round_trip_graph()
    config = route_planner.ACOConfig(num_ants=6, total_iterations=15, seed=5)
    routes = route_planner.plan_routes(
        graph, "p1", "p1", 3, config,
    ).routes

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
            graph, "solo", "solo", 3, config,
        ).routes
        == []
    )


def test_plan_routes_start_to_end_is_unchanged_by_the_loop_handling():
    fixture = make_graph()
    config = route_planner.ACOConfig(num_ants=4, total_iterations=12, seed=3)
    routes = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        3,
        config,
    ).routes

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


# coverage tiers


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
        edges.append(GraphEdge(f"c{i}", f"c{i + 1}", 1.0, 3.0))
        edges.append(GraphEdge(f"c{i + 1}", f"c{i}", 1.0, 3.0))
    return ParkGraph(park_id="line", nodes=nodes, edges=edges)


def _plan(graph, **config_kwargs):
    config = route_planner.ACOConfig(
        num_ants=6,
        total_iterations=20,
        seed=17,
        **{"coverage_tiers": KEEP_TOURS, **config_kwargs},
    )
    return route_planner.plan_routes(
        graph, "c0", "c8", 1, config,
    ).routes


def test_a_low_risk_weight_buys_more_coverage_than_a_high_one():
    graph = _coverage_graph()
    greedy = _plan(graph, risk_weight=0.001)
    stingy = _plan(graph, risk_weight=5.0)
    assert greedy[0].risk_coverage >= stingy[0].risk_coverage


def test_first_tier_reaches_everything_despite_a_blunt_risk_weight():
    graph = _coverage_graph()
    tiered = _plan(graph, risk_weight=5.0, coverage_tiers=(1.0,))
    assert tiered[0].risk_coverage == pytest.approx(1.0)


def test_coverage_tiers_leave_a_riskless_grid_alone():
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
        edges.append(GraphEdge(f"c{i}", f"c{i + 1}", 1.0, 3.0))
        edges.append(GraphEdge(f"c{i + 1}", f"c{i}", 1.0, 3.0))
    graph = ParkGraph(park_id="flat", nodes=nodes, edges=edges)
    config = route_planner.ACOConfig(
        num_ants=2, total_iterations=4, seed=1,
    )

    routes = route_planner.plan_routes(
        graph, "c0", "c2", 1, config,
    ).routes

    assert [r.suggested_path for r in routes] == [["c0", "c1", "c2"]]
    assert routes[0].risk_coverage == 0.0


def test_planning_stays_reproducible_with_coverage_tiers():
    graph = _coverage_graph()
    first = _plan(graph, coverage_tiers=(1.0, 0.7, 0.4))
    second = _plan(graph, coverage_tiers=(1.0, 0.7, 0.4))
    assert [r.suggested_path for r in first] == [
        r.suggested_path for r in second
    ]


def _branch_graph(risk: dict[str, float] | None = None) -> ParkGraph:
    """Build a start-end spine with two hotspot spurs off it."""
    specs = [
        ("br-s", 0.0), ("br-m", 0.0), ("br-e", 0.0),
        ("br-a1", 0.0), ("br-a2", 0.0), ("br-a3", 0.9),
        ("br-b1", 0.0), ("br-b2", 0.0), ("br-b3", 0.9),
    ]
    risk = risk or {}
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(float(i) * 0.01, 0.0)),
            risk_score=risk.get(nid, score),
        )
        for i, (nid, score) in enumerate(specs)
    ]
    pairs = [
        ("br-s", "br-m"), ("br-m", "br-e"),
        ("br-m", "br-a1"), ("br-a1", "br-a2"), ("br-a2", "br-a3"),
        ("br-m", "br-b1"), ("br-b1", "br-b2"), ("br-b2", "br-b3"),
    ]
    edges = [GraphEdge(a, b, 1.0, 3.0) for a, b in pairs] + [
        GraphEdge(b, a, 1.0, 3.0) for a, b in pairs
    ]
    return ParkGraph(park_id="branch", nodes=nodes, edges=edges)


def _branch_matrix(graph):
    hubs = ["br-s", "br-e", "br-a3", "br-b3"]
    return route_planner.build_waypoint_distance_matrix(graph, hubs)


def test_meet_coverage_target_inserts_hubs_until_the_target_is_met():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    matrix = _branch_matrix(graph)
    tour = ["br-s", "br-e"]
    expanded = matrix[("br-s", "br-e")].path
    assert route_planner.compute_risk_coverage(graph, expanded) == 0.0

    waypoints, path = route_planner.meet_coverage_target(
        graph, matrix, ["br-a3", "br-b3"], tour, expanded, 1.0,
    )

    assert set(waypoints) == {"br-s", "br-e", "br-a3", "br-b3"}
    assert route_planner.compute_risk_coverage(graph, path) == 1.0


def test_meet_coverage_target_stops_once_the_target_is_reached():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    matrix = _branch_matrix(graph)
    expanded = matrix[("br-s", "br-e")].path

    waypoints, path = route_planner.meet_coverage_target(
        graph, matrix, ["br-a3", "br-b3"], ["br-s", "br-e"], expanded, 0.5,
    )

    assert len(waypoints) == 3
    assert route_planner.compute_risk_coverage(graph, path) == 0.5


def test_meet_coverage_target_leaves_a_sufficient_tour_alone():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    matrix = _branch_matrix(graph)
    expanded = matrix[("br-s", "br-e")].path

    result = route_planner.meet_coverage_target(
        graph, matrix, ["br-a3", "br-b3"], ["br-s", "br-e"], expanded, 0.0,
    )

    assert result == (["br-s", "br-e"], expanded)


def test_meet_coverage_target_drops_hubs_the_target_does_not_need():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    matrix = _branch_matrix(graph)
    tour = ["br-s", "br-a3", "br-b3", "br-e"]
    expanded = route_planner.evaluate_hub_sequence(graph, matrix, tour)[0]
    assert route_planner.compute_risk_coverage(graph, expanded) == 1.0

    waypoints, path = route_planner.meet_coverage_target(
        graph, matrix, ["br-a3", "br-b3"], tour, expanded, 0.5,
    )

    assert len(waypoints) == 3
    assert route_planner.compute_risk_coverage(graph, path) == 0.5


def test_meet_coverage_target_keeps_hubs_the_target_needs():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    matrix = _branch_matrix(graph)
    tour = ["br-s", "br-a3", "br-b3", "br-e"]
    expanded = route_planner.evaluate_hub_sequence(graph, matrix, tour)[0]

    waypoints, _ = route_planner.meet_coverage_target(
        graph, matrix, ["br-a3", "br-b3"], tour, expanded, 1.0,
    )

    assert waypoints == tour


def test_plan_routes_lists_the_shortest_route_first():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=12, seed=3, max_extra_distance=10.0,
    )

    plan = route_planner.plan_routes(graph, "br-s", "br-e", 3, config)

    distances = [r.distance_km for r in plan.routes]
    assert distances == sorted(distances)


_LONG_WAY = ["n0", "n1", "n2", "n3", "n4"]
_SHORT_WAY = ["n0", "n1", "n3", "n4"]


def _long_then_short_plan(monkeypatch, max_extra_distance):
    _phase_stub(monkeypatch, [(_LONG_WAY, 0.9)] + [(_SHORT_WAY, 0.9)] * 5)
    config = _three_phase_config(
        diversity_threshold=0.9,
        min_diversity=0.05,
        max_extra_distance=max_extra_distance,
    )
    return route_planner.plan_routes(
        _shortcut_graph(), "n0", "n4", 2, config,
    )


def test_plan_routes_hides_routes_much_longer_than_the_best(monkeypatch):
    # the long way is 4 km against 3 km, a third longer
    plan = _long_then_short_plan(monkeypatch, 0.15)

    assert [r.suggested_path for r in plan.routes] == [_SHORT_WAY]
    assert plan.shortfall == route_planner.LONGER_THAN_BEST


def test_plan_routes_keeps_a_route_just_inside_the_limit(monkeypatch):
    plan = _long_then_short_plan(monkeypatch, 0.34)

    assert [r.suggested_path for r in plan.routes] == [_SHORT_WAY, _LONG_WAY]
    assert plan.shortfall is None


def test_equal_tiers_give_distinct_routes_of_equal_coverage():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=12, seed=3,
        phase_split=(0.5, 0.5, 0.0),
        coverage_tiers=(0.5, 0.5),
        max_extra_distance=10.0,
    )

    plan = route_planner.plan_routes(graph, "br-s", "br-e", 2, config)

    assert [r.risk_coverage for r in plan.routes] == [0.5, 0.5]
    first, second = (r.suggested_path for r in plan.routes)
    assert first != second


def _captured_targets(monkeypatch):
    targets = []
    original = route_planner.meet_coverage_target

    def spy(*args):
        targets.append(args[5])
        return original(*args)

    monkeypatch.setattr(route_planner, "meet_coverage_target", spy)
    return targets


def test_later_tiers_shrink_when_the_first_falls_short(monkeypatch):
    route_planner.clear_path_cache()
    graph = _branch_graph()
    targets = _captured_targets(monkeypatch)
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=12, seed=3, max_waypoints=1,
        phase_split=(0.5, 0.5, 0.0),
        coverage_tiers=(1.0, 0.8),
    )

    route_planner.plan_routes(graph, "br-s", "br-e", 2, config)

    assert targets[0] == 1.0
    assert targets[1:] == [pytest.approx(0.4)] * (len(targets) - 1)


def test_later_tiers_stay_put_when_the_first_overshoots(monkeypatch):
    route_planner.clear_path_cache()
    graph = _branch_graph()
    targets = _captured_targets(monkeypatch)
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=12, seed=3,
        phase_split=(0.5, 0.5, 0.0),
        coverage_tiers=(0.9, 0.4),
    )

    route_planner.plan_routes(graph, "br-s", "br-e", 2, config)

    assert targets == [0.9, 0.4]


def test_plan_routes_does_not_overshoot_a_low_tier():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    config = route_planner.ACOConfig(
        num_ants=4, total_iterations=12,
        seed=3, risk_weight=0.001, coverage_tiers=(0.5,),
    )

    plan = route_planner.plan_routes(graph, "br-s", "br-e", 1, config)

    assert [r.risk_coverage for r in plan.routes] == [0.5]


def test_meet_coverage_target_straightens_a_zigzag_visiting_order():
    route_planner.clear_path_cache()
    graph = _coverage_graph()
    hubs = ["c0", "c2", "c6", "c8"]
    matrix = route_planner.build_waypoint_distance_matrix(graph, hubs)
    zigzag = ["c0", "c6", "c2", "c8"]
    expanded = route_planner.evaluate_hub_sequence(graph, matrix, zigzag)[0]

    waypoints, path = route_planner.meet_coverage_target(
        graph, matrix, ["c2", "c6"], zigzag, expanded, 1.0,
    )

    assert waypoints == hubs
    assert path == [f"c{i}" for i in range(9)]


def _strip_graph(hot: dict[str, float]) -> ParkGraph:
    cells = {
        f"{row}{col}": (r, col)
        for r, row in enumerate("abc")
        for col in range(4)
    }
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(col * 0.01, -r * 0.01)),
            risk_score=hot.get(nid, 0.0),
        )
        for nid, (r, col) in cells.items()
    ]
    at = {rc: nid for nid, rc in cells.items()}
    edges = []
    for nid, (r, col) in cells.items():
        for d_r in (-1, 0, 1):
            for d_c in (-1, 0, 1):
                other = at.get((r + d_r, col + d_c))
                if other is None or other == nid:
                    continue
                cost = 1.41 if d_r and d_c else 1.0
                edges.append(GraphEdge(nid, other, cost, cost))
    return ParkGraph(park_id="strip", nodes=nodes, edges=edges)


_LOOPED = ["a0", "a1", "a2", "a3", "b3", "c2", "b1", "b0"]


def test_fold_spurs_retraces_a_detour_that_came_back_another_way():
    graph = _strip_graph({"a3": 0.9})
    weights = route_planner._hotspot_weights(graph)

    folded = route_planner._fold_spurs(graph, _LOOPED, weights, 0.9, [], 0.0)

    assert folded == ["a0", "a1", "a2", "a1", "a0", "b0"]


def test_fold_spurs_cuts_a_detour_nothing_needs():
    graph = _strip_graph({"a0": 0.9})
    weights = route_planner._hotspot_weights(graph)

    folded = route_planner._fold_spurs(graph, _LOOPED, weights, 0.9, [], 0.0)

    assert folded == ["a0", "b0"]


def test_fold_spurs_will_not_fold_into_a_copy_of_an_avoided_path():
    graph = _strip_graph({"a0": 0.9})
    weights = route_planner._hotspot_weights(graph)

    folded = route_planner._fold_spurs(
        graph, _LOOPED, weights, 0.9, [["a0", "b0"]], 0.05,
    )

    assert folded != ["a0", "b0"]


def test_fold_spurs_keeps_a_return_leg_that_covers_needed_risk():
    graph = _strip_graph({"a3": 0.9, "c3": 0.9})
    weights = route_planner._hotspot_weights(graph)

    folded = route_planner._fold_spurs(graph, _LOOPED, weights, 1.8, [], 0.0)

    assert folded == _LOOPED


def test_fold_spurs_drops_a_return_leg_the_target_can_spare():
    graph = _strip_graph({"a3": 0.9, "c2": 0.3})
    weights = route_planner._hotspot_weights(graph)

    folded = route_planner._fold_spurs(graph, _LOOPED, weights, 0.9, [], 0.0)

    assert folded == ["a0", "a1", "a2", "a1", "a0", "b0"]


def test_meet_coverage_target_stops_dropping_before_it_copies_a_route():
    route_planner.clear_path_cache()
    graph = _branch_graph()
    matrix = _branch_matrix(graph)
    tour = ["br-s", "br-a3", "br-b3", "br-e"]
    expanded = route_planner.evaluate_hub_sequence(graph, matrix, tour)[0]
    accepted = [
        route_planner.evaluate_hub_sequence(
            graph, matrix, ["br-s", "br-a3", "br-e"],
        )[0],
        route_planner.evaluate_hub_sequence(
            graph, matrix, ["br-s", "br-b3", "br-e"],
        )[0],
    ]

    waypoints, _ = route_planner.meet_coverage_target(
        graph, matrix, ["br-a3", "br-b3"], tour, expanded, 0.5,
        accepted, 0.05,
    )

    assert waypoints == tour


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
    assert route_planner.high_risk_threshold(graph) == pytest.approx(
        route_planner.DEFAULT_HIGH_RISK_THRESHOLD,
    )


def test_threshold_drops_to_the_quantile_on_a_dim_heatmap():
    graph = _risk_graph([0.0, 0.02, 0.05, 0.1, 0.15, 0.2])
    threshold = route_planner.high_risk_threshold(graph)
    assert threshold < route_planner.DEFAULT_HIGH_RISK_THRESHOLD
    assert threshold > 0.0


def test_threshold_finds_hotspots_a_fixed_cut_would_have_missed():
    graph = _risk_graph([0.0, 0.02, 0.05, 0.1, 0.15, 0.2])
    assert _stops(graph) != []
    assert _stops(graph, threshold=0.5) == []


def test_threshold_ignores_a_flat_heatmap():
    """No spread means no top, whatever the level."""
    for level in (0.0, 0.1, 0.2, 0.24):
        graph = _risk_graph([level] * 8)
        assert route_planner.high_risk_threshold(graph) == pytest.approx(
            route_planner.DEFAULT_HIGH_RISK_THRESHOLD,
        )
        assert _stops(graph) == []


def test_threshold_respects_the_floor_on_a_near_zero_heatmap():
    graph = _risk_graph([0.0, 0.0, 0.0, 0.001, 0.002])
    assert route_planner.high_risk_threshold(graph) == pytest.approx(
        route_planner.DEFAULT_HIGH_RISK_THRESHOLD,
    )


def test_threshold_is_cached_on_the_graph():
    graph = _risk_graph([0.1, 0.2, 0.3])
    first = route_planner.high_risk_threshold(graph)
    assert route_planner.high_risk_threshold(graph) == first
    assert graph._high_risk_threshold_cache == first


def test_threshold_handles_an_empty_grid():
    graph = ParkGraph(park_id="p", nodes=[], edges=[])
    assert route_planner.high_risk_threshold(graph) == pytest.approx(
        route_planner.DEFAULT_HIGH_RISK_THRESHOLD,
    )




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


def test_zone_stops_still_covers_every_cluster():
    graph = _two_cluster_graph()
    picked = set(_stops(graph))
    assert any(nid.startswith("near") for nid in picked)
    assert any(nid.startswith("far") for nid in picked)


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
            graph, "near0", "far0", 1, config,
        )
    finally:
        route_planner.build_waypoint_distance_matrix = original

    # start, end, and at most max_waypoints hotspots
    assert len(captured[0]) <= 4


def _spied_hubs(monkeypatch):
    captured = []
    original = route_planner.build_waypoint_distance_matrix

    def spy(g, node_ids):
        captured.append(list(node_ids))
        return original(g, node_ids)

    monkeypatch.setattr(route_planner, "build_waypoint_distance_matrix", spy)
    return captured


def test_plan_routes_skips_the_zone_it_starts_in(monkeypatch):
    route_planner.clear_path_cache()
    graph = _branch_graph({"br-a2": 0.3})
    assert ("br-a3", ["br-a2", "br-a3"]) in route_planner.hotspot_zones(graph)
    captured = _spied_hubs(monkeypatch)
    config = route_planner.ACOConfig(num_ants=2, total_iterations=4, seed=1)

    route_planner.plan_routes(graph, "br-a2", "br-e", 1, config)

    assert "br-a3" not in captured[0]
    assert "br-b3" in captured[0]


def test_plan_routes_skips_the_zone_it_ends_in(monkeypatch):
    route_planner.clear_path_cache()
    graph = _branch_graph({"br-a2": 0.3})
    captured = _spied_hubs(monkeypatch)
    config = route_planner.ACOConfig(num_ants=2, total_iterations=4, seed=1)

    route_planner.plan_routes(graph, "br-e", "br-a2", 1, config)

    assert "br-a3" not in captured[0]


# route diversity


def test_route_distance_is_zero_for_identical_paths():
    path = ["a", "b", "c"]
    assert route_planner.route_distance(path, path) == pytest.approx(0.0)


def test_route_distance_is_one_for_disjoint_paths():
    assert route_planner.route_distance(
        ["a", "b"], ["c", "d"],
    ) == pytest.approx(1.0)


def test_route_distance_is_partial_for_a_shared_leg():
    # {ab, bc} vs {ab, bd}: one shared of three
    assert route_planner.route_distance(
        ["a", "b", "c"], ["a", "b", "d"],
    ) == pytest.approx(2 / 3)


def test_route_distance_is_symmetric():
    a, b = ["p", "q", "r"], ["p", "r", "q"]
    assert route_planner.route_distance(a, b) == route_planner.route_distance(
        b, a,
    )


def test_route_distance_separates_reordered_stops_from_identical_ones():
    """The old hub-pair metric called a reordered tour fully diverse."""
    base = ["a", "b", "c", "d"]
    reordered = ["a", "c", "b", "d"]
    assert route_planner.route_distance(base, base) == pytest.approx(0.0)
    assert route_planner.route_distance(base, reordered) > 0.0


def test_route_distance_of_two_edgeless_paths_is_zero():
    assert route_planner.route_distance(["a"], ["a"]) == pytest.approx(0.0)


# alternative count and shortfall


def _phase_stub(monkeypatch, results):
    supply = iter(results)
    monkeypatch.setattr(
        route_planner,
        "run_phase",
        lambda *a, **k: (lambda r: (r[0], r[0], r[1], {}))(next(supply)),
    )
    monkeypatch.setattr(
        route_planner,
        "apply_partial_penalty",
        lambda pheromones, used_path, config: pheromones,
    )


def _three_phase_config(**kwargs):
    return route_planner.ACOConfig(
        total_iterations=9,
        phase_split=(0.34, 0.33, 0.33),
        coverage_tiers=KEEP_TOURS,
        **kwargs,
    )


def _shortcut_graph() -> ParkGraph:
    """n0-n1-n2-n3-n4 in a line, plus an n1-n3 shortcut past n2."""
    nodes = [
        GraphNode(
            node_id=f"n{i}",
            location=GeoPoint(coordinates=(float(i) * 0.01, 0.0)),
            risk_score=0.9,
        )
        for i in range(5)
    ]
    pairs = [(0, 1), (1, 2), (2, 3), (3, 4), (1, 3)]
    edges = [
        GraphEdge(f"n{a}", f"n{b}", 1.0, 3.0) for a, b in pairs
    ] + [GraphEdge(f"n{b}", f"n{a}", 1.0, 3.0) for a, b in pairs]
    return ParkGraph(park_id="shortcut", nodes=nodes, edges=edges)


def test_a_similar_route_is_kept_rather_than_dropped(monkeypatch):
    """Only near-duplicates are dropped; merely similar is still an option."""
    graph = _shortcut_graph()
    long_way = ["n0", "n1", "n2", "n3", "n4"]
    short_way = ["n0", "n1", "n3", "n4"]
    # they share n0-n1 and n3-n4, so distance is 0.6: similar, not a duplicate
    assert route_planner.route_distance(long_way, short_way) < 0.9
    assert route_planner.route_distance(long_way, short_way) > 0.05

    _phase_stub(monkeypatch, [(long_way, 0.9)] + [(short_way, 0.9)] * 5)
    config = _three_phase_config(
        diversity_threshold=0.9, min_diversity=0.05, max_extra_distance=1.0,
    )

    plan = route_planner.plan_routes(
        graph, "n0", "n4", 2, config,
    )

    assert len(plan.routes) == 2


def test_an_exact_duplicate_is_still_dropped(monkeypatch):
    fixture = make_graph()
    path = ["start", "mid", "end"]
    _phase_stub(monkeypatch, [(path, 0.9)] * 8)
    config = _three_phase_config()

    plan = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        2,
        config,
    )

    assert len(plan.routes) == 1
    assert plan.shortfall == route_planner.DUPLICATE_ROUTE


def test_shortfall_is_none_when_every_alternative_is_found(monkeypatch):
    fixture = make_graph()
    _phase_stub(
        monkeypatch,
        [(["start", "mid", "end"], 0.9), (["start", "end"], 0.9)],
    )
    config = _three_phase_config()

    plan = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        2,
        config,
    )

    assert len(plan.routes) == 2
    assert plan.shortfall is None


def test_shortfall_reports_when_no_tour_was_found(monkeypatch):
    fixture = make_graph()
    _phase_stub(monkeypatch, [([], 0.0)] * 8)
    config = _three_phase_config()

    plan = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        2,
        config,
    )

    assert plan.routes == []
    assert plan.shortfall == route_planner.NO_TOUR_FOUND


def test_a_low_coverage_alternative_is_still_returned(monkeypatch):
    fixture = make_graph()
    _phase_stub(
        monkeypatch,
        [(["start", "mid", "end"], 1.0), (["start", "end"], 0.1)],
    )
    config = _three_phase_config()

    plan = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        2,
        config,
    )

    assert len(plan.routes) == 2
    assert plan.shortfall is None


def test_the_search_retries_before_giving_up_on_a_duplicate(monkeypatch):
    fixture = make_graph()
    calls = []
    supply = iter(
        [(["start", "mid", "end"], 0.9)] * 3 + [(["start", "end"], 0.9)] * 5,
    )

    def counting_run_phase(*a, **k):
        path, risk = next(supply)
        calls.append(path)
        return path, path, risk, {}

    monkeypatch.setattr(route_planner, "run_phase", counting_run_phase)
    monkeypatch.setattr(
        route_planner,
        "apply_partial_penalty",
        lambda pheromones, used_path, config: pheromones,
    )
    config = _three_phase_config(diversity_retries=2)

    plan = route_planner.plan_routes(
        fixture.graph,
        fixture.start_node_id,
        fixture.end_node_id,
        2,
        config,
    )

    # phase one accepts at once, phase two retries past the repeat
    assert len(calls) > 2
    assert len(plan.routes) == 2


# local search


def _line_matrix(graph: ParkGraph, node_ids: list[str]):
    return route_planner.build_waypoint_distance_matrix(graph, node_ids)


def _detour_graph() -> ParkGraph:
    """Build four collinear cells where hub order decides tour length."""
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(lon, lat)),
            risk_score=0.9,
        )
        for nid, lon, lat in (
            ("a", 0.0, 0.0),
            ("b", 0.01, 0.0),
            ("c", 0.02, 0.0),
            ("d", 0.03, 0.0),
        )
    ]
    km = {("a", "b"): 1.0, ("b", "c"): 1.0, ("c", "d"): 1.0,
          ("a", "c"): 2.0, ("b", "d"): 2.0, ("a", "d"): 3.0}
    edges = []
    for (x, y), dist in km.items():
        edges.append(GraphEdge(x, y, dist, dist * 3))
        edges.append(GraphEdge(y, x, dist, dist * 3))
    return ParkGraph(park_id="detour", nodes=nodes, edges=edges)


def _spur_graph() -> ParkGraph:
    """Two routes from s to e; only the long one passes within reach of h2."""
    names = ("s", "m1", "m2", "e", "h1", "h2", "h3")
    nodes = [
        GraphNode(
            node_id=name,
            location=GeoPoint(coordinates=(i * 0.01, 0.0)),
            risk_score=0.9 if name == "h2" else 0.0,
        )
        for i, name in enumerate(names)
    ]
    chains = [
        ("s", "m1"), ("m1", "m2"), ("m2", "e"),
        ("s", "h1"), ("h1", "h2"), ("h2", "h3"), ("h3", "e"),
    ]
    edges = []
    for a, b in chains:
        edges.append(GraphEdge(a, b, 1.0, 3.0))
        edges.append(GraphEdge(b, a, 1.0, 3.0))
    return ParkGraph(park_id="spur", nodes=nodes, edges=edges)


def test_evaluate_hub_sequence_matches_a_constructed_tour():
    graph = _spur_graph()
    matrix = _line_matrix(graph, ["s", "e", "h2"])

    direct = route_planner.evaluate_hub_sequence(graph, matrix, ["s", "e"])
    assert direct[0] == ["s", "m1", "m2", "e"]
    assert direct[1] == pytest.approx(9.0)
    assert direct[2] == pytest.approx(0.0)

    detour = route_planner.evaluate_hub_sequence(
        graph, matrix, ["s", "h2", "e"],
    )
    assert detour[0] == ["s", "h1", "h2", "h3", "e"]
    assert detour[1] == pytest.approx(12.0)
    assert detour[2] == pytest.approx(0.9)


def test_evaluate_hub_sequence_returns_none_for_an_unreachable_hop():
    graph = _detour_graph()
    assert (
        route_planner.evaluate_hub_sequence(graph, {}, ["a", "b"]) is None
    )


def test_evaluate_hub_sequence_returns_none_for_a_single_node():
    graph = _detour_graph()
    matrix = _line_matrix(graph, ["a", "b"])
    assert route_planner.evaluate_hub_sequence(graph, matrix, ["a"]) is None


def test_improve_hub_sequence_shortens_a_crossed_order():
    graph = _detour_graph()
    matrix = _line_matrix(graph, ["a", "b", "c", "d"])
    crossed = ["a", "c", "b", "d"]
    improved = route_planner.improve_hub_sequence(matrix, crossed)

    assert route_planner._sequence_time(
        matrix, improved,
    ) < route_planner._sequence_time(matrix, crossed)


def test_improve_hub_sequence_keeps_the_same_stops():
    graph = _detour_graph()
    matrix = _line_matrix(graph, ["a", "b", "c", "d"])
    crossed = ["a", "c", "b", "d"]
    improved = route_planner.improve_hub_sequence(matrix, crossed)

    assert sorted(improved) == sorted(crossed)
    assert improved[0] == "a"
    assert improved[-1] == "d"


def test_improve_hub_sequence_leaves_an_optimal_order_alone():
    graph = _detour_graph()
    matrix = _line_matrix(graph, ["a", "b", "c", "d"])
    best = ["a", "b", "c", "d"]
    assert route_planner.improve_hub_sequence(matrix, best) == best


def test_improve_hub_sequence_ignores_a_sequence_too_short_to_reorder():
    graph = _detour_graph()
    matrix = _line_matrix(graph, ["a", "b"])
    assert route_planner.improve_hub_sequence(matrix, ["a", "b"]) == ["a", "b"]


def test_locally_improved_tour_keeps_the_original_when_no_move_helps():
    graph = _detour_graph()
    matrix = _line_matrix(graph, ["a", "b", "c", "d"])
    path = ["a", "b", "c", "d"]
    scored = route_planner.evaluate_hub_sequence(graph, matrix, path)
    expanded, time_used, risk = scored

    result = route_planner.locally_improved_tour(
        graph, matrix, path, expanded, time_used, risk,
        route_planner.ACOConfig(),
    )

    assert result[0] == path


# greedy seed


def test_greedy_tour_takes_a_detour_that_pays_for_itself():
    graph = _spur_graph()
    matrix = _line_matrix(graph, ["s", "e", "h2"])
    result = route_planner.greedy_tour(
        graph, matrix, ["h2"], "s", "e",
        route_planner.ACOConfig(risk_weight=0.001),
    )

    assert result[0] == ["s", "h2", "e"]


def test_greedy_tour_skips_a_detour_that_costs_more_than_it_pays():
    graph = _spur_graph()
    matrix = _line_matrix(graph, ["s", "e", "h2"])
    result = route_planner.greedy_tour(
        graph, matrix, ["h2"], "s", "e",
        route_planner.ACOConfig(risk_weight=50.0),
    )

    assert result[0] == ["s", "e"]


def test_greedy_tour_is_deterministic():
    graph = _spur_graph()
    matrix = _line_matrix(graph, ["s", "e", "h2"])
    config = route_planner.ACOConfig()
    first = route_planner.greedy_tour(graph, matrix, ["h2"], "s", "e", config)
    second = route_planner.greedy_tour(graph, matrix, ["h2"], "s", "e", config)
    assert first[0] == second[0]


def test_greedy_tour_returns_none_without_a_route_to_the_end():
    graph = _spur_graph()
    assert route_planner.greedy_tour(
        graph, {}, ["h2"], "s", "e", route_planner.ACOConfig(),
    ) is None


def test_the_greedy_seed_only_primes_the_first_phase(monkeypatch):
    """Later phases must explore away from it, or alternatives collapse."""
    graph = _spur_graph()
    seen = []
    original = route_planner.run_phase

    def spy(*args, **kwargs):
        seen.append(kwargs.get("seed_tour"))
        return original(*args, **kwargs)

    monkeypatch.setattr(route_planner, "run_phase", spy)
    route_planner.plan_routes(
        graph, "s", "e", 3,
        route_planner.ACOConfig(num_ants=2, total_iterations=6, seed=1),
    )

    assert seen[0] is not None
    assert any(entry is None for entry in seen[1:])


# cross-request path cache


def test_the_distance_matrix_reuses_cached_paths(monkeypatch):
    route_planner.clear_path_cache()
    graph = _spur_graph()
    calls = []
    original = route_planner.dijkstra

    def counting(g, source, targets=None):
        calls.append(source)
        return original(g, source, targets=targets)

    monkeypatch.setattr(route_planner, "dijkstra", counting)

    first = route_planner.build_waypoint_distance_matrix(graph, ["s", "e"])
    after_first = len(calls)
    second = route_planner.build_waypoint_distance_matrix(graph, ["s", "e"])

    assert first == second
    assert after_first > 0
    assert len(calls) == after_first


def test_clearing_the_cache_forces_a_fresh_search(monkeypatch):
    route_planner.clear_path_cache()
    graph = _spur_graph()
    calls = []
    original = route_planner.dijkstra

    def counting(g, source, targets=None):
        calls.append(source)
        return original(g, source, targets=targets)

    monkeypatch.setattr(route_planner, "dijkstra", counting)

    route_planner.build_waypoint_distance_matrix(graph, ["s", "e"])
    route_planner.clear_path_cache()
    before = len(calls)
    route_planner.build_waypoint_distance_matrix(graph, ["s", "e"])

    assert len(calls) > before


def test_the_cache_only_searches_for_pairs_it_is_missing(monkeypatch):
    route_planner.clear_path_cache()
    graph = _spur_graph()
    route_planner.build_waypoint_distance_matrix(graph, ["s", "e"])

    requested = []
    original = route_planner.dijkstra

    def counting(g, source, targets=None):
        requested.append((source, sorted(targets or [])))
        return original(g, source, targets=targets)

    monkeypatch.setattr(route_planner, "dijkstra", counting)
    route_planner.build_waypoint_distance_matrix(graph, ["s", "e", "h2"])

    assert ("s", ["e"]) not in requested
    assert any("h2" in targets for _, targets in requested)


def test_an_unreachable_pair_is_cached_as_missing(monkeypatch):
    route_planner.clear_path_cache()
    nodes = [
        GraphNode(
            node_id=nid,
            location=GeoPoint(coordinates=(0.0, 0.0)),
            risk_score=0.0,
        )
        for nid in ("x", "y")
    ]
    graph = ParkGraph(park_id="p", nodes=nodes, edges=[])

    calls = []
    original = route_planner.dijkstra
    monkeypatch.setattr(
        route_planner,
        "dijkstra",
        lambda g, source, targets=None: (
            calls.append(source) or original(g, source, targets=targets)
        ),
    )

    assert route_planner.build_waypoint_distance_matrix(graph, ["x", "y"]) == {}
    before = len(calls)
    assert route_planner.build_waypoint_distance_matrix(graph, ["x", "y"]) == {}
    assert len(calls) == before
