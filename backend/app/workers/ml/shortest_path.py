import heapq
import math
from dataclasses import dataclass

from app.schemas.route import ParkGraph


@dataclass(frozen=True)
class PathResult:
    time_min: float
    fuel_l: float
    path: list[str]


def dijkstra(graph: ParkGraph, source_node_id: str) -> dict[str, PathResult]:
    """Shortest paths from source_node_id to every node reachable from it.

    Weighted by est_time_min. route_repository.py gives every edge the same
    speed/fuel profile (for now at least), so time and fuel are proportional per
    edge. The time-shortest path is also the fuel-shortest path.
    Unreachable nodes are absent from the result.
    """
    adjacency: dict[str, list] = {}
    for edge in graph.edges:
        adjacency.setdefault(edge.from_node_id, []).append(edge)

    best_time = {source_node_id: 0.0}
    best_fuel = {source_node_id: 0.0}
    prev: dict[str, str] = {}
    visited: set[str] = set()
    heap: list[tuple[float, str]] = [(0.0, source_node_id)]

    while heap:
        time_so_far, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        for edge in adjacency.get(node, []):
            neighbor = edge.to_node_id
            candidate_time = time_so_far + edge.est_time_min
            if candidate_time < best_time.get(neighbor, math.inf):
                best_time[neighbor] = candidate_time
                best_fuel[neighbor] = best_fuel[node] + edge.est_fuel_l
                prev[neighbor] = node
                heapq.heappush(heap, (candidate_time, neighbor))

    results = {}
    for node_id, time_min in best_time.items():
        path = [node_id]
        current = node_id
        while current != source_node_id:
            current = prev[current]
            path.append(current)
        path.reverse()
        results[node_id] = PathResult(
            time_min=time_min,
            fuel_l=best_fuel[node_id],
            path=path,
        )
    return results
