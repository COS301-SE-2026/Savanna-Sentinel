import pytest

from app.schemas.geo import GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph
from app.workers.ml.shortest_path import dijkstra


def _node(node_id: str) -> GraphNode:
    return GraphNode(
        node_id=node_id,
        location=GeoPoint(coordinates=(0.0, 0.0)),
        risk_score=0.0,
    )


def make_line_graph() -> ParkGraph:
    """p1 - p2 - p3 - p4 - p5, bidirectional, each hop costs 3 min / 0.15 L."""
    nodes = [_node(n) for n in ("p1", "p2", "p3", "p4", "p5")]
    pairs = [("p1", "p2"), ("p2", "p3"), ("p3", "p4"), ("p4", "p5")]
    edges = []
    for a, b in pairs:
        edges.append(
            GraphEdge(a, b, distance_km=1.0, est_time_min=3.0, est_fuel_l=0.15),
        )
        edges.append(
            GraphEdge(b, a, distance_km=1.0, est_time_min=3.0, est_fuel_l=0.15),
        )
    return ParkGraph(park_id="line", nodes=nodes, edges=edges)


def make_diamond_graph() -> ParkGraph:
    """Build a graph with A -> B -> D (cheap) and A -> C -> D (expensive)."""
    nodes = [_node(n) for n in ("a", "b", "c", "d")]
    edges = [
        GraphEdge("a", "b", distance_km=1.0, est_time_min=2.0, est_fuel_l=0.1),
        GraphEdge("b", "d", distance_km=1.0, est_time_min=2.0, est_fuel_l=0.1),
        GraphEdge("a", "c", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.0),
        GraphEdge("c", "d", distance_km=1.0, est_time_min=10.0, est_fuel_l=1.0),
    ]
    return ParkGraph(park_id="diamond", nodes=nodes, edges=edges)


def test_dijkstra_source_to_itself_is_zero_cost():
    graph = make_line_graph()
    results = dijkstra(graph, "p1")
    assert results["p1"].time_min == pytest.approx(0.0)
    assert results["p1"].fuel_l == pytest.approx(0.0)
    assert results["p1"].path == ["p1"]


def test_dijkstra_sums_cost_and_builds_path_along_a_line():
    graph = make_line_graph()
    results = dijkstra(graph, "p1")
    assert results["p4"].time_min == pytest.approx(9.0)
    assert results["p4"].fuel_l == pytest.approx(0.45)
    assert results["p4"].path == ["p1", "p2", "p3", "p4"]


def test_dijkstra_picks_cheaper_of_two_routes():
    graph = make_diamond_graph()
    results = dijkstra(graph, "a")
    assert results["d"].time_min == pytest.approx(4.0)
    assert results["d"].fuel_l == pytest.approx(0.2)
    assert results["d"].path == ["a", "b", "d"]


def test_dijkstra_omits_unreachable_nodes():
    nodes = [_node("a"), _node("b"), _node("isolated")]
    graph = ParkGraph(
        park_id="p",
        nodes=nodes,
        edges=[
            GraphEdge(
                "a",
                "b",
                distance_km=1.0,
                est_time_min=1.0,
                est_fuel_l=0.1,
            ),
        ],
    )
    results = dijkstra(graph, "a")
    assert "isolated" not in results
    assert set(results) == {"a", "b"}
