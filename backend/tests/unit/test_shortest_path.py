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
            GraphEdge(a, b, distance_km=1.0, est_time_min=3.0),
        )
        edges.append(
            GraphEdge(b, a, distance_km=1.0, est_time_min=3.0),
        )
    return ParkGraph(park_id="line", nodes=nodes, edges=edges)


def make_diamond_graph() -> ParkGraph:
    """Build a graph with A -> B -> D (cheap) and A -> C -> D (expensive)."""
    nodes = [_node(n) for n in ("a", "b", "c", "d")]
    edges = [
        GraphEdge("a", "b", distance_km=1.0, est_time_min=2.0),
        GraphEdge("b", "d", distance_km=1.0, est_time_min=2.0),
        GraphEdge("a", "c", distance_km=1.0, est_time_min=10.0),
        GraphEdge("c", "d", distance_km=1.0, est_time_min=10.0),
    ]
    return ParkGraph(park_id="diamond", nodes=nodes, edges=edges)


def test_dijkstra_source_to_itself_is_zero_cost():
    graph = make_line_graph()
    results = dijkstra(graph, "p1")
    assert results["p1"].time_min == pytest.approx(0.0)
    assert results["p1"].path == ["p1"]


def test_dijkstra_sums_cost_and_builds_path_along_a_line():
    graph = make_line_graph()
    results = dijkstra(graph, "p1")
    assert results["p4"].time_min == pytest.approx(9.0)
    assert results["p4"].path == ["p1", "p2", "p3", "p4"]


def test_dijkstra_picks_cheaper_of_two_routes():
    graph = make_diamond_graph()
    results = dijkstra(graph, "a")
    assert results["d"].time_min == pytest.approx(4.0)
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
            ),
        ],
    )
    results = dijkstra(graph, "a")
    assert "isolated" not in results
    assert set(results) == {"a", "b"}


def test_dijkstra_targets_narrow_the_result():
    graph = make_line_graph()
    results = dijkstra(graph, "p1", targets=["p3", "p5"])
    assert set(results) == {"p3", "p5"}
    assert results["p3"].path == ["p1", "p2", "p3"]
    assert results["p5"].time_min == pytest.approx(12.0)


def test_dijkstra_targets_give_the_same_costs_as_an_unfiltered_run():
    graph = make_line_graph()
    full = dijkstra(graph, "p1")
    narrowed = dijkstra(graph, "p1", targets=["p4"])
    assert narrowed["p4"] == full["p4"]


def test_dijkstra_targets_omit_unreachable_nodes():
    graph = make_diamond_graph()
    graph.edges.append(
        GraphEdge(
            "stranded",
            "a",
            distance_km=1.0,
            est_time_min=1.0,
        ),
    )
    results = dijkstra(graph, "a", targets=["d", "stranded"])
    assert set(results) == {"d"}


def test_dijkstra_with_no_targets_returns_nothing():
    graph = make_line_graph()
    assert dijkstra(graph, "p1", targets=[]) == {}


def test_dijkstra_targets_accept_a_consumable_iterable():
    graph = make_line_graph()
    results = dijkstra(graph, "p1", targets=(n for n in ("p2", "p3")))
    assert set(results) == {"p2", "p3"}


class _RecordingAdjacency(dict):
    """Adjacency map that records which nodes the search expanded."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.expanded: list[str] = []

    def get(self, key, default=None):
        self.expanded.append(key)
        return super().get(key, default)


def _recording_adjacency(graph: ParkGraph) -> _RecordingAdjacency:
    adjacency = _RecordingAdjacency()
    for edge in graph.edges:
        adjacency.setdefault(edge.from_node_id, []).append(edge)
    graph._adjacency_cache = adjacency
    return adjacency


def test_dijkstra_stops_once_every_target_is_settled():
    graph = make_line_graph()
    adjacency = _recording_adjacency(graph)

    dijkstra(graph, "p1", targets=["p2"])

    # p2 settles on the second pop, so nothing past it is ever expanded.
    assert adjacency.expanded == ["p1"]


def test_dijkstra_without_targets_still_drains_the_graph():
    graph = make_line_graph()
    adjacency = _recording_adjacency(graph)

    dijkstra(graph, "p1")

    assert adjacency.expanded == ["p1", "p2", "p3", "p4", "p5"]


def test_adjacency_is_cached_on_the_graph_across_calls():
    graph = make_line_graph()
    dijkstra(graph, "p1")
    cached = graph._adjacency_cache
    dijkstra(graph, "p2")
    assert graph._adjacency_cache is cached


def test_dijkstra_sees_edges_added_to_a_fresh_graph():
    """A new ParkGraph gets its own adjacency, so caching cannot leak."""
    first = make_line_graph()
    dijkstra(first, "p1")
    second = make_diamond_graph()
    results = dijkstra(second, "a", targets=["d"])
    assert results["d"].path == ["a", "b", "d"]
