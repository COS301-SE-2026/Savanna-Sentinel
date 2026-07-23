import math
import random
from dataclasses import dataclass

from app.schemas.geo import GeoLineString, GeoPoint
from app.schemas.route import GraphEdge, GraphNode, ParkGraph, PlannedRoute
from app.workers.ml.path_smoothing import chaikin_smooth


@dataclass
class ACOConfig:
    num_ants: int = 20
    total_iterations: int = 100
    phase_split: tuple[float, float, float] = (0.4, 0.3, 0.3)
    alpha: float = 1.0
    beta: float = 2.0
    rho: float = 0.1
    tau_max: float = 5.0
    tau_min: float = 0.01
    penalty_factor: float = 0.3
    diversity_threshold: float = 0.3
    # candidate must retain >= 90% of best risk_coverage
    quality_threshold: float = 0.9


def init_pheromones(
    graph: ParkGraph,
    config: ACOConfig,
) -> dict[tuple[str, str], float]:
    return {(e.from_node_id, e.to_node_id): config.tau_max for e in graph.edges}


def _adjacency(graph: ParkGraph) -> dict[str, list[GraphEdge]]:
    """Outgoing edges grouped by from_node_id, cached on the graph.

    feasible_edges() used to linearly scan every edge in the graph on every
    single step of every ants tour. This is graph-invariant data - safe to
    compute once and reuse for the life of the graph object.
    """
    cached = getattr(graph, "_adjacency_cache", None)
    if cached is None:
        cached = {}
        for e in graph.edges:
            cached.setdefault(e.from_node_id, []).append(e)
        graph._adjacency_cache = cached
    return cached


def _node_lookup(graph: ParkGraph) -> dict[str, GraphNode]:
    cached = getattr(graph, "_node_lookup_cache", None)
    if cached is None:
        cached = {n.node_id: n for n in graph.nodes}
        graph._node_lookup_cache = cached
    return cached


def _node_risk(graph: ParkGraph) -> dict[str, float]:
    cached = getattr(graph, "_node_risk_cache", None)
    if cached is None:
        cached = {n.node_id: n.risk_score for n in graph.nodes}
        graph._node_risk_cache = cached
    return cached


def _min_per_km_rates(graph: ParkGraph) -> tuple[float, float]:
    """Graph-wide best-case (minimum) per-km time/fuel rate, cached on graph."""
    cached = getattr(graph, "_min_per_km_rates_cache", None)
    if cached is None:
        rates = [
            (e.est_time_min / e.distance_km, e.est_fuel_l / e.distance_km)
            for e in graph.edges
            if e.distance_km > 0
        ]
        cached = (
            (min(r[0] for r in rates), min(r[1] for r in rates))
            if rates
            else (0.0, 0.0)
        )
        graph._min_per_km_rates_cache = cached
    return cached


def _haversine_km(a: GeoPoint, b: GeoPoint) -> float:
    lon1, lat1 = a.coordinates
    lon2, lat2 = b.coordinates
    earth_radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(h))


def estimate_return_cost(
    graph: ParkGraph, node_id: str, end_node_id: str,
) -> tuple[float, float]:
    """Straight-line lower-bound estimate of (time, fuel) to reach end node."""
    node_lookup = _node_lookup(graph)
    if node_id not in node_lookup or end_node_id not in node_lookup:
        return 0.0, 0.0
    distance_km = _haversine_km(
        node_lookup[node_id].location, node_lookup[end_node_id].location,
    )
    # Use the graph's best-case (minimum) per-km rates so the estimate never
    # exceeds the true remaining cost - required to be a valid lower bound.
    min_time_per_km, min_fuel_per_km = _min_per_km_rates(graph)
    return distance_km * min_time_per_km, distance_km * min_fuel_per_km


def feasible_edges(
    graph: ParkGraph,
    current_node: str,
    end_node_id: str,
    visited: set[str],
    time_remaining: float,
    fuel_remaining: float,
) -> list[GraphEdge]:
    candidates = []
    for e in _adjacency(graph).get(current_node, []):
        if e.to_node_id in visited:
            continue
        time_left_after = time_remaining - e.est_time_min
        fuel_left_after = fuel_remaining - e.est_fuel_l
        if time_left_after < 0 or fuel_left_after < 0:
            continue
        est_return_time, est_return_fuel = estimate_return_cost(
            graph, e.to_node_id, end_node_id,
        )
        if (
            est_return_time > time_left_after
            or est_return_fuel > fuel_left_after
        ):
            continue
        candidates.append(e)
    return candidates


def select_next_edge(
    candidates: list[GraphEdge],
    pheromones: dict,
    graph: ParkGraph,
    config: ACOConfig,
) -> GraphEdge | None:
    if not candidates:
        return None
    node_risk = _node_risk(graph)
    weights = []
    for e in candidates:
        tau = pheromones.get((e.from_node_id, e.to_node_id), config.tau_min)
        heuristic = (node_risk.get(e.to_node_id, 0.0001) + 0.0001) / (
            e.est_time_min + e.est_fuel_l + 1
        )
        weights.append((tau**config.alpha) * (heuristic**config.beta))
    total = sum(weights)
    if total == 0:
        return random.choice(candidates)
    r = random.uniform(0, total)
    cumulative = 0.0
    for edge, w in zip(candidates, weights):
        cumulative += w
        if r <= cumulative:
            return edge
    return candidates[-1]


def construct_tour(
    graph: ParkGraph,
    start_node_id: str,
    end_node_id: str,
    max_time: float,
    max_fuel: float,
    pheromones: dict,
    config: ACOConfig,
) -> tuple[list[str], float, float, float]:
    path, visited = [start_node_id], {start_node_id}
    time_left, fuel_left, risk_total = max_time, max_fuel, 0.0
    node_risk = _node_risk(graph)
    current = start_node_id
    while current != end_node_id:
        candidates = feasible_edges(
            graph, current, end_node_id, visited, time_left, fuel_left,
        )
        edge = select_next_edge(candidates, pheromones, graph, config)
        if edge is None:
            break
        path.append(edge.to_node_id)
        visited.add(edge.to_node_id)
        time_left -= edge.est_time_min
        fuel_left -= edge.est_fuel_l
        risk_total += node_risk.get(edge.to_node_id, 0.0)
        current = edge.to_node_id
    return path, max_time - time_left, max_fuel - fuel_left, risk_total


def update_pheromones(
    pheromones: dict,
    best_path: list[str],
    best_risk: float,
    config: ACOConfig,
) -> dict:
    updated = {
        edge: max(tau * (1 - config.rho), config.tau_min)
        for edge, tau in pheromones.items()
    }
    for a, b in zip(best_path, best_path[1:]):
        deposit = updated.get((a, b), config.tau_min) + config.rho * best_risk
        updated[(a, b)] = min(deposit, config.tau_max)
    return updated


def apply_partial_penalty(
    pheromones: dict, used_path: list[str], config: ACOConfig,
) -> dict:
    penalized = dict(pheromones)
    for a, b in zip(used_path, used_path[1:]):
        current = penalized.get((a, b), config.tau_min)
        penalized[(a, b)] = max(current * config.penalty_factor, config.tau_min)
    return penalized


def run_phase(
    graph: ParkGraph,
    start_node_id: str,
    end_node_id: str,
    max_time: float,
    max_fuel: float,
    pheromones: dict,
    num_iterations: int,
    config: ACOConfig,
) -> tuple[list[str], float, dict]:
    best_path, best_risk = [], -1.0
    for _ in range(num_iterations):
        tours = []
        for _ in range(config.num_ants):
            path, _, _, risk = construct_tour(
                graph,
                start_node_id,
                end_node_id,
                max_time,
                max_fuel,
                pheromones,
                config,
            )
            if path[-1] == end_node_id:
                tours.append((path, risk))
        if not tours:
            continue
        iter_best_path, iter_best_risk = max(tours, key=lambda t: t[1])
        pheromones = update_pheromones(
            pheromones, iter_best_path, iter_best_risk, config,
        )
        if iter_best_risk > best_risk:
            best_path, best_risk = iter_best_path, iter_best_risk
    return best_path, best_risk, pheromones


def edge_set(path: list[str]) -> set[tuple[str, str]]:
    return set(zip(path, path[1:]))


def is_sufficiently_diverse(
    candidate_path: list[str],
    prior_paths: list[list[str]],
    threshold: float,
) -> bool:
    candidate_edges = edge_set(candidate_path)
    for prior in prior_paths:
        prior_edges = edge_set(prior)
        overlap_ratio = len(candidate_edges & prior_edges) / max(
            len(candidate_edges | prior_edges), 1,
        )
        if (1 - overlap_ratio) < threshold:
            return False
    return True


def is_sufficient_quality(
    candidate_risk: float, best_risk_so_far: float, config: ACOConfig,
) -> bool:
    """Reject a candidate whose risk_coverage is too far below the best.

    "Too far" means more than approx 10% below the best accepted path.
    """
    if best_risk_so_far <= 0:
        return True
    return candidate_risk >= config.quality_threshold * best_risk_so_far


def plan_routes(
    graph: ParkGraph,
    start_node_id: str,
    end_node_id: str,
    max_time_min: float,
    max_fuel_l: float,
    num_alternatives: int = 3,
    config: ACOConfig | None = None,
) -> list[PlannedRoute]:
    config = config or ACOConfig()
    pheromones = init_pheromones(graph, config)
    iterations_per_phase = [
        int(config.total_iterations * f)
        for f in config.phase_split[:num_alternatives]
    ]
    accepted_paths: list[list[str]] = []
    accepted_risks: list[float] = []
    for n_iter in iterations_per_phase:
        candidate_path, candidate_risk, pheromones = run_phase(
            graph,
            start_node_id,
            end_node_id,
            max_time_min,
            max_fuel_l,
            pheromones,
            n_iter,
            config,
        )
        if not candidate_path:
            continue
        best_so_far = max(accepted_risks) if accepted_risks else candidate_risk
        passes = is_sufficiently_diverse(
            candidate_path, accepted_paths, config.diversity_threshold,
        ) and is_sufficient_quality(candidate_risk, best_so_far, config)
        if not passes:
            # one retry with a stronger penalty already in effect
            pheromones = apply_partial_penalty(
                pheromones, candidate_path, config,
            )
            candidate_path, candidate_risk, pheromones = run_phase(
                graph,
                start_node_id,
                end_node_id,
                max_time_min,
                max_fuel_l,
                pheromones,
                n_iter,
                config,
            )
            passes = (
                candidate_path
                and is_sufficiently_diverse(
                    candidate_path, accepted_paths, config.diversity_threshold,
                )
                and is_sufficient_quality(candidate_risk, best_so_far, config)
            )
        if not passes:
            # drop this phase's result, do not force a weak/duplicate path in
            continue
        accepted_paths.append(candidate_path)
        accepted_risks.append(candidate_risk)
        pheromones = apply_partial_penalty(pheromones, candidate_path, config)
    return [
        _to_planned_route(graph, p, r)
        for p, r in zip(accepted_paths, accepted_risks)
    ]


def _to_planned_route(
    graph: ParkGraph, path: list[str], risk_coverage: float,
) -> PlannedRoute:
    node_lookup = {n.node_id: n for n in graph.nodes}
    edge_lookup = {(e.from_node_id, e.to_node_id): e for e in graph.edges}
    coords = [node_lookup[nid].location.coordinates for nid in path]
    smoothed = chaikin_smooth(coords, iterations=2)
    edges_used = [edge_lookup[pair] for pair in zip(path, path[1:])]
    return PlannedRoute(
        suggested_path=path,
        path_geometry=GeoLineString(coordinates=smoothed),
        estimated_time_min=sum(e.est_time_min for e in edges_used),
        estimated_fuel_l=sum(e.est_fuel_l for e in edges_used),
        risk_coverage=risk_coverage,
    )
