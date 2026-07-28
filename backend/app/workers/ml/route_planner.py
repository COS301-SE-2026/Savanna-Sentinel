import math
import random
from dataclasses import dataclass

from app.schemas.geo import GeoLineString
from app.schemas.route import ParkGraph, PlannedRoute
from app.workers.ml.path_smoothing import chaikin_smooth
from app.workers.ml.shortest_path import PathResult, dijkstra


@dataclass
class ACOConfig:
    num_ants: int = 20
    total_iterations: int = 100
    # len() of this bounds how many alternatives plan_routes() can ever
    # return - keep RouteRequest.MAX_NUM_ALTERNATIVES in sync if it changes.
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
    distance_matrix: dict[tuple[str, str], PathResult],
    config: ACOConfig,
) -> dict[tuple[str, str], float]:
    return {pair: config.tau_max for pair in distance_matrix}


def _node_risk(graph: ParkGraph) -> dict[str, float]:
    cached = getattr(graph, "_node_risk_cache", None)
    if cached is None:
        cached = {n.node_id: n.risk_score for n in graph.nodes}
        graph._node_risk_cache = cached
    return cached


def _coverage_neighbors(graph: ParkGraph) -> dict[str, frozenset[str]]:
    """node_id -> itself plus every node directly graph-adjacent to it.

    Since this graph's edges are built from grid adjacency (see
    route_repository._load_grid), a node's direct neighbours are its
    geometric surroundings. Used as a patrol-presence/deterrence coverage
    radius: a cell counts as covered if the route passes adjacent to it.

    This is a documented simplification, and not specifically final.
    """
    cached = getattr(graph, "_coverage_neighbors_cache", None)
    if cached is None:
        undirected: dict[str, set[str]] = {}
        for e in graph.edges:
            undirected.setdefault(e.from_node_id, set()).add(e.to_node_id)
            undirected.setdefault(e.to_node_id, set()).add(e.from_node_id)
        cached = {
            n.node_id: frozenset({n.node_id} | undirected.get(n.node_id, set()))
            for n in graph.nodes
        }
        graph._coverage_neighbors_cache = cached
    return cached


def covered_nodes(graph: ParkGraph, path: list[str]) -> frozenset[str]:
    """Every node covered by a path: the path's nodes plus their neighbours."""
    neighbors = _coverage_neighbors(graph)
    covered: set[str] = set()
    for node_id in path:
        covered |= neighbors.get(node_id, {node_id})
    return frozenset(covered)


DEFAULT_HIGH_RISK_THRESHOLD = 0.5


def select_waypoints(
    graph: ParkGraph,
    threshold: float = DEFAULT_HIGH_RISK_THRESHOLD,
) -> list[str]:
    """High-risk nodes needed to cover every high-risk node (greedy set cover).

    A patrol only needs to get within one hop of a hotspot cell to count
    it as covered (see covered_nodes/compute_risk_coverage), so treating
    every single high-risk cell as a waypoint the route must physically
    visit causes the search to weave back and forth across a dense cluster.
    Picking a minimal representative set instead gives the macro route planner a
    handful of stops per hotspot rather than one per cell.
    """
    node_risk = _node_risk(graph)
    coverage_neighbors = _coverage_neighbors(graph)
    high_risk = {nid for nid, score in node_risk.items() if score >= threshold}
    uncovered = set(high_risk)
    waypoints: list[str] = []
    while uncovered:
        best_node = max(
            high_risk,
            key=lambda nid: len(coverage_neighbors.get(nid, {nid}) & uncovered),
        )
        newly_covered = (
            coverage_neighbors.get(best_node, {best_node}) & uncovered
        )
        if not newly_covered:
            break
        waypoints.append(best_node)
        uncovered -= newly_covered
    return waypoints


def build_waypoint_distance_matrix(
    graph: ParkGraph,
    node_ids: list[str],
) -> dict[tuple[str, str], PathResult]:
    """All-pairs shortest paths among a small set of hub nodes.

    One Dijkstra run per hub (start, end, and the hotspot waypoints from
    select_waypoints. Not the full grid), so this stays cheap. A pair
    absent from the result means 'to' isn't reachable from 'from' on the
    graph. Self-pairs arent included.
    """
    matrix: dict[tuple[str, str], PathResult] = {}
    for source in node_ids:
        reachable = dijkstra(graph, source)
        for target in node_ids:
            if target == source:
                continue
            result = reachable.get(target)
            if result is not None:
                matrix[(source, target)] = result
    return matrix


def feasible_waypoints(
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    current_node: str,
    end_node_id: str,
    visited: set[str],
    time_remaining: float,
    fuel_remaining: float,
) -> list[str]:
    """Unvisited waypoints (plus end node) reachable without stranding the tour.

    Feasibility is checked against the exact precomputed shortest-path
    cost from build_waypoint_distance_matrix, not an estimate. The old
    cell-by-cell search only had a straight-line lower bound to work
    with, but operating over a handful of hub nodes makes the real
    number cheap to precompute for every pair up front.
    """
    candidates = []
    for target in list(dict.fromkeys([*waypoint_ids, end_node_id])):
        if target in visited:
            continue
        hop = distance_matrix.get((current_node, target))
        if hop is None:
            continue
        time_left_after = time_remaining - hop.time_min
        fuel_left_after = fuel_remaining - hop.fuel_l
        if time_left_after < 0 or fuel_left_after < 0:
            continue
        if target != end_node_id:
            return_hop = distance_matrix.get((target, end_node_id))
            if return_hop is None:
                continue
            if (
                return_hop.time_min > time_left_after
                or return_hop.fuel_l > fuel_left_after
            ):
                continue
        candidates.append(target)
    return candidates


def select_next_waypoint(
    candidates: list[str],
    pheromones: dict[tuple[str, str], float],
    distance_matrix: dict[tuple[str, str], PathResult],
    current_node: str,
    node_risk: dict[str, float],
    config: ACOConfig,
    covered: frozenset[str] = frozenset(),
) -> str | None:
    if not candidates:
        return None
    weights = []
    for target in candidates:
        tau = pheromones.get((current_node, target), config.tau_min)
        # A candidate already within the tour's coverage radius so far
        # contributes no further risk (mitigates revisiting issues)
        risk = 0.0 if target in covered else node_risk.get(target, 0.0001)
        hop = distance_matrix[(current_node, target)]
        heuristic = (risk + 0.0001) / (hop.time_min + hop.fuel_l + 1)
        weights.append((tau**config.alpha) * (heuristic**config.beta))
    total = sum(weights)
    if total == 0:
        return random.choice(candidates)
    r = random.uniform(0, total)
    cumulative = 0.0
    for target, w in zip(candidates, weights):
        cumulative += w
        if r <= cumulative:
            return target
    return candidates[-1]


def construct_waypoint_tour(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    start_node_id: str,
    end_node_id: str,
    max_time: float | None,
    max_fuel: float | None,
    pheromones: dict,
    config: ACOConfig,
) -> tuple[list[str], list[str], float, float, float]:
    """One ant's tour over hub nodes, stitched from real shortest-path nodes.

    Returns (waypoint_path, expanded_path, time_used, fuel_used, risk_total).
    expanded_path is the actual raw-grid node sequence. Every consecutive
    pair is a real graph edge, which is what geometry/cost/coverage get
    computed from. risk_total is discounted the same way
    select_next_waypoint's heuristic is: a node already covered by the
    tour so far (including nodes merely passed through in transit) adds
    nothing further, so the fitness ants are optimized for actually
    matching the coverage metric shown to users, instead of just rewarding
    whoever happens to touch the most cells directly.
    """
    node_risk = _node_risk(graph)
    coverage_neighbors = _coverage_neighbors(graph)
    time_left = max_time if max_time is not None else math.inf
    fuel_left = max_fuel if max_fuel is not None else math.inf
    time_used, fuel_used, risk_total = 0.0, 0.0, 0.0

    waypoint_path = [start_node_id]
    expanded_path = [start_node_id]
    visited = {start_node_id}
    covered = set(coverage_neighbors.get(start_node_id, {start_node_id}))
    current = start_node_id

    while current != end_node_id:
        candidates = feasible_waypoints(
            distance_matrix,
            waypoint_ids,
            current,
            end_node_id,
            visited,
            time_left,
            fuel_left,
        )
        chosen = select_next_waypoint(
            candidates,
            pheromones,
            distance_matrix,
            current,
            node_risk,
            config,
            frozenset(covered),
        )
        if chosen is None:
            break
        hop = distance_matrix[(current, chosen)]
        time_left -= hop.time_min
        fuel_left -= hop.fuel_l
        time_used += hop.time_min
        fuel_used += hop.fuel_l
        # Union the whole hop's coverage before diffing against covered,
        # so an earlier node's radius cant shadow a later node's credit
        # based on loop order.
        hop_covered: set[str] = set()
        for node_id in hop.path[1:]:
            hop_covered |= coverage_neighbors.get(node_id, {node_id})
        newly_covered = hop_covered - covered
        risk_total += sum(node_risk.get(n, 0.0) for n in newly_covered)
        covered |= hop_covered
        expanded_path.extend(hop.path[1:])
        waypoint_path.append(chosen)
        visited.add(chosen)
        current = chosen

    return waypoint_path, expanded_path, time_used, fuel_used, risk_total


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
    pheromones: dict,
    used_path: list[str],
    config: ACOConfig,
) -> dict:
    penalized = dict(pheromones)
    for a, b in zip(used_path, used_path[1:]):
        current = penalized.get((a, b), config.tau_min)
        penalized[(a, b)] = max(current * config.penalty_factor, config.tau_min)
    return penalized


def tour_efficiency(
    risk_total: float,
    time_used: float,
    fuel_used: float,
) -> float:
    """Risk captured per unit of time/fuel spent getting it.

    Raw summed risk favours padding the route to the full budget, since
    almost any extra stop adds some risk. Risk-per-cost lets a short,
    efficient tour beat a longer one that only picked up small risk.
    """
    return risk_total / (time_used + fuel_used + 1)


def run_phase(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    start_node_id: str,
    end_node_id: str,
    max_time: float | None,
    max_fuel: float | None,
    pheromones: dict,
    num_iterations: int,
    config: ACOConfig,
) -> tuple[list[str], list[str], float, dict]:
    best_waypoint_path: list[str] = []
    best_expanded_path: list[str] = []
    best_risk, best_efficiency = -1.0, -1.0
    for _ in range(num_iterations):
        tours = []
        for _ in range(config.num_ants):
            waypoint_path, expanded_path, time_used, fuel_used, risk = (
                construct_waypoint_tour(
                    graph,
                    distance_matrix,
                    waypoint_ids,
                    start_node_id,
                    end_node_id,
                    max_time,
                    max_fuel,
                    pheromones,
                    config,
                )
            )
            if waypoint_path[-1] == end_node_id:
                tours.append(
                    (waypoint_path, expanded_path, risk, time_used, fuel_used),
                )
        if not tours:
            continue
        iter_best = max(tours, key=lambda t: tour_efficiency(t[2], t[3], t[4]))
        (
            iter_best_waypoint_path,
            iter_best_expanded_path,
            iter_best_risk,
            iter_best_time,
            iter_best_fuel,
        ) = iter_best
        pheromones = update_pheromones(
            pheromones,
            iter_best_waypoint_path,
            iter_best_risk,
            config,
        )
        iter_efficiency = tour_efficiency(
            iter_best_risk,
            iter_best_time,
            iter_best_fuel,
        )
        if iter_efficiency > best_efficiency:
            best_waypoint_path = iter_best_waypoint_path
            best_expanded_path = iter_best_expanded_path
            best_risk = iter_best_risk
            best_efficiency = iter_efficiency
    return best_waypoint_path, best_expanded_path, best_risk, pheromones


def compute_risk_coverage(
    graph: ParkGraph,
    path: list[str],
    threshold: float = DEFAULT_HIGH_RISK_THRESHOLD,
) -> float:
    """Fraction of the grid's high-risk cells the path covers, in [0, 1].

    "Covers" means within one cell of the path (see covered_nodes()), a
    patrol presence model rather than guaranteed detection. This is the
    normalised figure shown to the user as "risk coverage".
    """
    node_risk = _node_risk(graph)
    high_risk_nodes = {
        nid for nid, score in node_risk.items() if score >= threshold
    }
    if not high_risk_nodes:
        return 0.0
    covered = covered_nodes(graph, path)
    return len(high_risk_nodes & covered) / len(high_risk_nodes)


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
            len(candidate_edges | prior_edges),
            1,
        )
        if (1 - overlap_ratio) < threshold:
            return False
    return True


def is_sufficient_quality(
    candidate_risk: float,
    best_risk_so_far: float,
    config: ACOConfig,
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
    max_time_min: float | None,
    max_fuel_l: float | None,
    num_alternatives: int = 3,
    config: ACOConfig | None = None,
) -> list[PlannedRoute]:
    config = config or ACOConfig()
    waypoint_ids = [
        w
        for w in select_waypoints(graph)
        if w not in (start_node_id, end_node_id)
    ]
    hub_ids = list(dict.fromkeys([start_node_id, end_node_id, *waypoint_ids]))
    distance_matrix = build_waypoint_distance_matrix(graph, hub_ids)
    pheromones = init_pheromones(distance_matrix, config)
    iterations_per_phase = [
        int(config.total_iterations * f)
        for f in config.phase_split[:num_alternatives]
    ]
    accepted_waypoint_paths: list[list[str]] = []
    accepted_expanded_paths: list[list[str]] = []
    accepted_risks: list[float] = []
    for n_iter in iterations_per_phase:
        waypoint_path, expanded_path, candidate_risk, pheromones = run_phase(
            graph,
            distance_matrix,
            waypoint_ids,
            start_node_id,
            end_node_id,
            max_time_min,
            max_fuel_l,
            pheromones,
            n_iter,
            config,
        )
        if not waypoint_path:
            continue
        best_so_far = max(accepted_risks) if accepted_risks else candidate_risk
        passes = is_sufficiently_diverse(
            waypoint_path,
            accepted_waypoint_paths,
            config.diversity_threshold,
        ) and is_sufficient_quality(candidate_risk, best_so_far, config)
        if not passes:
            # one retry with a stronger penalty already in effect
            pheromones = apply_partial_penalty(
                pheromones,
                waypoint_path,
                config,
            )
            waypoint_path, expanded_path, candidate_risk, pheromones = (
                run_phase(
                    graph,
                    distance_matrix,
                    waypoint_ids,
                    start_node_id,
                    end_node_id,
                    max_time_min,
                    max_fuel_l,
                    pheromones,
                    n_iter,
                    config,
                )
            )
            passes = (
                waypoint_path
                and is_sufficiently_diverse(
                    waypoint_path,
                    accepted_waypoint_paths,
                    config.diversity_threshold,
                )
                and is_sufficient_quality(candidate_risk, best_so_far, config)
            )
        if not passes:
            # drop this phase's result, do not force a weak/duplicate path in
            continue
        accepted_waypoint_paths.append(waypoint_path)
        accepted_expanded_paths.append(expanded_path)
        accepted_risks.append(candidate_risk)
        pheromones = apply_partial_penalty(pheromones, waypoint_path, config)
    return [
        _to_planned_route(graph, p, compute_risk_coverage(graph, p))
        for p in accepted_expanded_paths
    ]


def _to_planned_route(
    graph: ParkGraph,
    path: list[str],
    risk_coverage: float,
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
