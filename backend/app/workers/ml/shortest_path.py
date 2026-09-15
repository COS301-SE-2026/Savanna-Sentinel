import heapq
import math
from collections.abc import Iterable
from dataclasses import dataclass

from app.schemas.route import GraphEdge, ParkGraph


@dataclass(frozen=True)
class PathResult:
    time_min: float
    path: list[str]


def _adjacency(graph: ParkGraph) -> dict[str, list[GraphEdge]]:
    cached = getattr(graph, "_adjacency_cache", None)
    if cached is None:
        cached = {}
        for edge in graph.edges:
            cached.setdefault(edge.from_node_id, []).append(edge)
        graph._adjacency_cache = cached
    return cached


def dijkstra(
    graph: ParkGraph,
    source_node_id: str,
    targets: Iterable[str] | None = None,
) -> dict[str, PathResult]:
    adjacency = _adjacency(graph)
    target_ids = None if targets is None else set(targets)
    pending = None if target_ids is None else set(target_ids)

    best_time = {source_node_id: 0.0}
    prev: dict[str, str] = {}
    visited: set[str] = set()
    heap: list[tuple[float, str]] = [(0.0, source_node_id)]

    while heap:
        time_so_far, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        if pending is not None:
            pending.discard(node)
            if not pending:
                break
        for edge in adjacency.get(node, []):
            neighbor = edge.to_node_id
            candidate_time = time_so_far + edge.est_time_min
            if candidate_time < best_time.get(neighbor, math.inf):
                best_time[neighbor] = candidate_time
                prev[neighbor] = node
                heapq.heappush(heap, (candidate_time, neighbor))

    wanted = best_time if target_ids is None else target_ids & visited
    results = {}
    for node_id in wanted:
        path = [node_id]
        current = node_id
        while current != source_node_id:
            current = prev[current]
            path.append(current)
        path.reverse()
        results[node_id] = PathResult(
            time_min=best_time[node_id],
            path=path,
        )
    return results
