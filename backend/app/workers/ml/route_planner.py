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
    # below this a candidate is a duplicate, not merely a similar route
    min_diversity: float = 0.05
    diversity_retries: int = 2
    seed: int | None = None
    # risk units charged per minute of patrol time
    risk_weight: float = 0.1
    # Coverage each alternative is reshaped to, as a fraction of the first
    # route's coverage (the first's of all hotspots). None keeps the tour
    # as the colony found it. Pairs with phase_split, so keep them in step.
    coverage_tiers: tuple[float | None, ...] = (1.0, 0.7, 0.4)
    max_waypoints: int = 60
    # 2-opt/or-opt shorten transit, which costs coverage picked up in
    # transit, so this is off by default. See improve_hub_sequence.
    local_search: bool = False
    seed_with_greedy: bool = True


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


KM_PER_DEGREE = 111.0
# matches the map's "Medium" band (frontend mapTokens.getRiskLevel)
DEFAULT_HIGH_RISK_THRESHOLD = 0.25
HIGH_RISK_QUANTILE = 0.85
HIGH_RISK_FLOOR = 0.05


def high_risk_threshold(
    graph: ParkGraph,
    absolute: float = DEFAULT_HIGH_RISK_THRESHOLD,
    quantile: float = HIGH_RISK_QUANTILE,
    floor: float = HIGH_RISK_FLOOR,
) -> float:
    """Risk score at or above which a cell counts as a hotspot.

    Falls back to the grid's own top quantile only when nothing clears the
    absolute cut, so a heatmap that peaks below it still yields hotspots.
    The fallback needs the quantile to sit above the grid's lowest score,
    otherwise a flat heatmap would promote every cell on it.
    """
    cached = getattr(graph, "_high_risk_threshold_cache", None)
    if cached is None:
        scores = sorted(_node_risk(graph).values())
        cached = absolute
        if scores and scores[-1] < absolute:
            index = min(int(quantile * len(scores)), len(scores) - 1)
            candidate = scores[index]
            if candidate > scores[0] and candidate >= floor:
                cached = candidate
        graph._high_risk_threshold_cache = cached
    return cached


def _km_between(a: tuple[float, float], b: tuple[float, float]) -> float:
    d_lon = (a[0] - b[0]) * math.cos(math.radians(b[1])) * KM_PER_DEGREE
    d_lat = (a[1] - b[1]) * KM_PER_DEGREE
    return math.hypot(d_lon, d_lat)


def select_waypoints(
    graph: ParkGraph,
    threshold: float | None = None,
    limit: int | None = None,
) -> list[str]:
    if threshold is None:
        threshold = high_risk_threshold(graph)
    node_risk = _node_risk(graph)
    coverage_neighbors = _coverage_neighbors(graph)
    location = {n.node_id: n.location.coordinates for n in graph.nodes}
    high_risk = [nid for nid, score in node_risk.items() if score >= threshold]
    uncovered = set(high_risk)
    waypoints: list[str] = []
    nearest_km: dict[str, float] = {}

    def rank(nid: str) -> float:
        gain = len(coverage_neighbors.get(nid, {nid}) & uncovered)
        if not gain:
            return 0.0
        return gain / (1.0 + nearest_km.get(nid, 0.0))

    while uncovered and (limit is None or len(waypoints) < limit):
        best_node = max(high_risk, key=rank)
        newly_covered = (
            coverage_neighbors.get(best_node, {best_node}) & uncovered
        )
        if not newly_covered:
            break
        waypoints.append(best_node)
        uncovered -= newly_covered
        chosen_at = location.get(best_node)
        if chosen_at is not None:
            for nid in high_risk:
                at = location.get(nid)
                if at is None:
                    continue
                distance = _km_between(at, chosen_at)
                if distance < nearest_km.get(nid, math.inf):
                    nearest_km[nid] = distance
    return waypoints


_PATH_CACHE: dict[tuple[str, str], PathResult | None] = {}


def clear_path_cache() -> None:
    """Drop cached hub-to-hub paths. Call when the park grid changes."""
    _PATH_CACHE.clear()


def build_waypoint_distance_matrix(
    graph: ParkGraph,
    node_ids: list[str],
) -> dict[tuple[str, str], PathResult]:
    """All-pairs shortest paths among the hub nodes.

    Shortest paths depend only on the grid, not on the risk scores that
    change per request, so results are cached across requests and
    invalidated by route_repository.invalidate_grid_cache.
    """
    matrix: dict[tuple[str, str], PathResult] = {}
    for source in node_ids:
        missing = [
            target
            for target in node_ids
            if target != source and (source, target) not in _PATH_CACHE
        ]
        if missing:
            reachable = dijkstra(graph, source, targets=missing)
            for target in missing:
                _PATH_CACHE[(source, target)] = reachable.get(target)
        for target in node_ids:
            if target == source:
                continue
            result = _PATH_CACHE.get((source, target))
            if result is not None:
                matrix[(source, target)] = result
    return matrix


def feasible_waypoints(
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    current_node: str,
    end_node_id: str,
    visited: set[str],
    targets: list[str] | None = None,
) -> list[str]:
    """Unvisited waypoints, plus the end node, that the tour can still reach."""
    if targets is None:
        targets = list(dict.fromkeys([*waypoint_ids, end_node_id]))
    candidates = []
    for target in targets:
        if target in visited:
            continue
        if (current_node, target) not in distance_matrix:
            continue
        # a waypoint the tour could not leave again would strand it
        if target != end_node_id and (target, end_node_id) not in (
            distance_matrix
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
    rng: random.Random,
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
        heuristic = (risk + 0.0001) / (hop.time_min + 1)
        weights.append((tau**config.alpha) * (heuristic**config.beta))
    total = sum(weights)
    if total == 0:
        return rng.choice(candidates)  # NOSONAR
    r = rng.uniform(0, total)
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
    pheromones: dict,
    config: ACOConfig,
    rng: random.Random,
) -> tuple[list[str], list[str], float, float]:
    """One ant's tour over hub nodes, stitched from real shortest-path nodes.

    Returns (waypoint_path, expanded_path, time_used, risk_total).
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
    time_used, risk_total = 0.0, 0.0

    waypoint_path = [start_node_id]
    expanded_path = [start_node_id]
    visited = {start_node_id}
    covered = set(coverage_neighbors.get(start_node_id, {start_node_id}))
    current = start_node_id
    closed_tour = start_node_id == end_node_id
    targets = list(dict.fromkeys([*waypoint_ids, end_node_id]))

    while True:
        candidates = feasible_waypoints(
            distance_matrix,
            waypoint_ids,
            current,
            end_node_id,
            visited,
            targets,
        )
        chosen = select_next_waypoint(
            candidates,
            pheromones,
            distance_matrix,
            current,
            node_risk,
            config,
            rng,
            frozenset(covered),
        )
        if chosen is None:
            break
        hop = distance_matrix[(current, chosen)]
        time_used += hop.time_min
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
        if closed_tour:
            visited.discard(end_node_id)
        if current == end_node_id:
            break

    return waypoint_path, expanded_path, time_used, risk_total


def evaluate_hub_sequence(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
) -> tuple[list[str], float, float] | None:
    """Expand a hub order into (path, time, risk), or None if unreachable.

    Scores risk exactly as construct_waypoint_tour does, so a local search
    move is compared against the tour on the same terms.
    """
    if len(sequence) < 2:
        return None
    node_risk = _node_risk(graph)
    coverage_neighbors = _coverage_neighbors(graph)
    start = sequence[0]
    expanded = [start]
    time_used = risk_total = 0.0
    covered = set(coverage_neighbors.get(start, {start}))
    for a, b in zip(sequence, sequence[1:]):
        hop = distance_matrix.get((a, b))
        if hop is None:
            return None
        time_used += hop.time_min
        hop_covered: set[str] = set()
        for node_id in hop.path[1:]:
            hop_covered |= coverage_neighbors.get(node_id, {node_id})
        risk_total += sum(node_risk.get(n, 0.0) for n in hop_covered - covered)
        covered |= hop_covered
        expanded.extend(hop.path[1:])
    return expanded, time_used, risk_total


def _sequence_time(
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
) -> float | None:
    total = 0.0
    for a, b in zip(sequence, sequence[1:]):
        hop = distance_matrix.get((a, b))
        if hop is None:
            return None
        total += hop.time_min
    return total


def _two_opt_candidates(sequence: list[str]):
    for i in range(1, len(sequence) - 2):
        for j in range(i + 1, len(sequence) - 1):
            yield sequence[:i] + sequence[i : j + 1][::-1] + sequence[j + 1 :]


def _or_opt_candidates(sequence: list[str]):
    for i in range(1, len(sequence) - 1):
        without = sequence[:i] + sequence[i + 1 :]
        for j in range(1, len(without)):
            if j == i:
                continue
            yield without[:j] + [sequence[i]] + without[j:]


def improve_hub_sequence(
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
    moves=(_two_opt_candidates, _or_opt_candidates),
) -> list[str]:
    """Shorten a hub order by 2-opt and or-opt, keeping the same stops.

    Ranked on travel time alone, which is a matrix lookup per hop rather
    than a full re-expansion. Visiting the same hubs in less time cannot
    lose coverage of the hubs themselves, and the caller re-scores the
    result before keeping it.
    """
    best = sequence
    best_time = _sequence_time(distance_matrix, best)
    if best_time is None or len(best) < 4:
        return best
    improved = True
    while improved:
        improved = False
        for move in moves:
            for candidate in move(best):
                candidate_time = _sequence_time(distance_matrix, candidate)
                if candidate_time is not None and candidate_time < best_time:
                    best, best_time = candidate, candidate_time
                    improved = True
    return best


def locally_improved_tour(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_path: list[str],
    expanded_path: list[str],
    time_used: float,
    risk_total: float,
    config: ACOConfig,
) -> tuple[list[str], list[str], float, float]:
    """Keep the local-search result only when it beats its starting tour."""
    improved = improve_hub_sequence(distance_matrix, waypoint_path)
    if improved == waypoint_path:
        return waypoint_path, expanded_path, time_used, risk_total
    scored = evaluate_hub_sequence(graph, distance_matrix, improved)
    if scored is None:
        return waypoint_path, expanded_path, time_used, risk_total
    new_path, new_time, new_risk = scored
    before = tour_score(risk_total, time_used, config.risk_weight)
    after = tour_score(new_risk, new_time, config.risk_weight)
    if after <= before:
        return waypoint_path, expanded_path, time_used, risk_total
    return improved, new_path, new_time, new_risk


def greedy_tour(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    start_node_id: str,
    end_node_id: str,
    config: ACOConfig,
) -> tuple[list[str], list[str], float, float] | None:
    """Insert whichever waypoint most improves tour_score, until none does.

    Deterministic, and good enough on its own to give the colony a decent
    starting point instead of its first iteration being pure noise.
    """
    sequence = [start_node_id, end_node_id]
    scored = evaluate_hub_sequence(graph, distance_matrix, sequence)
    if scored is None:
        return None
    best_score = tour_score(scored[2], scored[1], config.risk_weight)
    remaining = [
        w for w in waypoint_ids if w not in (start_node_id, end_node_id)
    ]
    while remaining:
        best_move = None
        for waypoint in remaining:
            for position in range(1, len(sequence)):
                candidate = (
                    sequence[:position] + [waypoint] + sequence[position:]
                )
                result = evaluate_hub_sequence(
                    graph,
                    distance_matrix,
                    candidate,
                )
                if result is None:
                    continue
                score = tour_score(result[2], result[1], config.risk_weight)
                if score > best_score and (
                    best_move is None or score > best_move[0]
                ):
                    best_move = (score, candidate, waypoint, result)
        if best_move is None:
            break
        best_score, sequence, waypoint, scored = best_move
        remaining.remove(waypoint)
    expanded, time_used, risk_total = scored
    return sequence, expanded, time_used, risk_total


def update_pheromones(
    pheromones: dict,
    best_path: list[str],
    best_score: float,
    config: ACOConfig,
) -> dict:
    updated = {
        edge: max(tau * (1 - config.rho), config.tau_min)
        for edge, tau in pheromones.items()
    }
    # a tour whose cost outweighs its risk reinforces nothing
    strength = config.rho * max(best_score, 0.0)
    for a, b in zip(best_path, best_path[1:]):
        deposit = updated.get((a, b), config.tau_min) + strength
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


def tour_score(
    risk_total: float,
    time_used: float,
    risk_weight: float,
) -> float:
    """Risk covered, less the patrol time it cost to cover it."""
    return risk_total - risk_weight * time_used


def run_phase(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    start_node_id: str,
    end_node_id: str,
    pheromones: dict,
    num_iterations: int,
    config: ACOConfig,
    rng: random.Random,
    seed_tour: tuple[list[str], list[str], float, float, float] | None = None,
) -> tuple[list[str], list[str], float, dict]:
    best_waypoint_path: list[str] = []
    best_expanded_path: list[str] = []
    best_risk, best_score = -1.0, -math.inf
    for iteration in range(num_iterations):
        tours = []
        constructed = [
            construct_waypoint_tour(
                graph,
                distance_matrix,
                waypoint_ids,
                start_node_id,
                end_node_id,
                pheromones,
                config,
                rng,
            )
            for _ in range(config.num_ants)
        ]
        if seed_tour is not None and iteration == 0:
            constructed.append(seed_tour)
        for tour in constructed:
            waypoint_path, expanded_path, time_used, risk = tour
            if len(waypoint_path) <= 1 or waypoint_path[-1] != end_node_id:
                continue
            tours.append((waypoint_path, expanded_path, risk, time_used))
        if not tours:
            continue
        iter_best = max(
            tours,
            key=lambda t: tour_score(t[2], t[3], config.risk_weight),
        )
        (
            iter_best_waypoint_path,
            iter_best_expanded_path,
            iter_best_risk,
            iter_best_time,
        ) = iter_best
        if config.local_search:
            # only the iteration best, so this costs once per iteration
            # rather than once per ant
            (
                iter_best_waypoint_path,
                iter_best_expanded_path,
                iter_best_time,
                iter_best_risk,
            ) = locally_improved_tour(
                graph,
                distance_matrix,
                iter_best_waypoint_path,
                iter_best_expanded_path,
                iter_best_time,
                iter_best_risk,
                config,
            )
        iter_score = tour_score(
            iter_best_risk,
            iter_best_time,
            config.risk_weight,
        )
        pheromones = update_pheromones(
            pheromones,
            iter_best_waypoint_path,
            iter_score,
            config,
        )
        if iter_score > best_score:
            best_waypoint_path = iter_best_waypoint_path
            best_expanded_path = iter_best_expanded_path
            best_risk = iter_best_risk
            best_score = iter_score
    return best_waypoint_path, best_expanded_path, best_risk, pheromones


def compute_risk_coverage(
    graph: ParkGraph,
    path: list[str],
    threshold: float | None = None,
) -> float:
    """Fraction of the grid's high-risk cells the path covers, in [0, 1].

    "Covers" means within one cell of the path (see covered_nodes()), a
    patrol presence model rather than guaranteed detection. This is the
    normalised figure shown to the user as "risk coverage".
    """
    high_risk_nodes = _high_risk_nodes(graph, threshold)
    if not high_risk_nodes:
        return 0.0
    covered = covered_nodes(graph, path)
    return len(high_risk_nodes & covered) / len(high_risk_nodes)


def _high_risk_nodes(
    graph: ParkGraph,
    threshold: float | None = None,
) -> frozenset[str]:
    if threshold is not None:
        return frozenset(
            nid for nid, score in _node_risk(graph).items()
            if score >= threshold
        )
    cached = getattr(graph, "_high_risk_nodes_cache", None)
    if cached is None:
        cached = _high_risk_nodes(graph, high_risk_threshold(graph))
        graph._high_risk_nodes_cache = cached
    return cached


@dataclass
class _ScoredTour:
    hubs: list[str]
    path: list[str]
    time: float
    risk: float
    covered_count: int


def _score_tour(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    high_risk: frozenset[str],
    hubs: list[str],
) -> _ScoredTour | None:
    scored = evaluate_hub_sequence(graph, distance_matrix, hubs)
    if scored is None:
        return None
    path, time_used, risk_total = scored
    count = len(high_risk & covered_nodes(graph, path))
    return _ScoredTour(hubs, path, time_used, risk_total, count)


def _add_hubs(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    high_risk: frozenset[str],
    waypoint_ids: list[str],
    tour: _ScoredTour,
    needed: int,
) -> _ScoredTour:
    """Insert hubs, best coverage gain per added minute first."""
    while tour.covered_count < needed:
        best, best_value = None, 0.0
        for waypoint in waypoint_ids:
            if waypoint in tour.hubs:
                continue
            for position in range(1, len(tour.hubs)):
                candidate = _score_tour(
                    graph,
                    distance_matrix,
                    high_risk,
                    tour.hubs[:position] + [waypoint] + tour.hubs[position:],
                )
                if candidate is None:
                    continue
                gain = candidate.covered_count - tour.covered_count
                added = max(candidate.time - tour.time, 0.0)
                value = gain / (added + 1.0)
                if gain > 0 and value > best_value:
                    best, best_value = candidate, value
        if best is None:
            return tour
        tour = best
    return tour


def _drop_hubs(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    high_risk: frozenset[str],
    tour: _ScoredTour,
    needed: int,
    avoid: list[list[str]],
    min_distance: float,
) -> _ScoredTour:
    """Remove whichever hub saves the most time without going under needed.

    A removal that would turn the tour into a copy of an avoided path is
    skipped, so alternatives don't all shrink onto the same minimal route.
    """
    while True:
        best = None
        for i in range(1, len(tour.hubs) - 1):
            candidate = _score_tour(
                graph,
                distance_matrix,
                high_risk,
                tour.hubs[:i] + tour.hubs[i + 1:],
            )
            if (
                candidate is None
                or candidate.covered_count < needed
                or candidate.time >= tour.time
                or any(
                    route_distance(candidate.path, prior) < min_distance
                    for prior in avoid
                )
            ):
                continue
            if best is None or candidate.time < best.time:
                best = candidate
        if best is None:
            return tour
        tour = best


def _first_shorter_order(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    high_risk: frozenset[str],
    tour: _ScoredTour,
    needed: int,
) -> _ScoredTour | None:
    for move in (_two_opt_candidates, _or_opt_candidates):
        for hubs in move(tour.hubs):
            time_used = _sequence_time(distance_matrix, hubs)
            if time_used is None or time_used >= tour.time - 1e-9:
                continue
            candidate = _score_tour(graph, distance_matrix, high_risk, hubs)
            if candidate is not None and candidate.covered_count >= needed:
                return candidate
    return None


def _shorten_order(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    high_risk: frozenset[str],
    tour: _ScoredTour,
    needed: int,
) -> _ScoredTour:
    """Reorder hubs by 2-opt/or-opt, removing spikes and crossings.

    Unlike improve_hub_sequence, each move is kept only if the tour still
    covers needed cells, since a shorter transit can pass fewer of them.
    """
    while True:
        shorter = _first_shorter_order(
            graph, distance_matrix, high_risk, tour, needed,
        )
        if shorter is None:
            return tour
        tour = shorter


def meet_coverage_target(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    waypoint_path: list[str],
    expanded_path: list[str],
    target: float | None,
    avoid: list[list[str]] | None = None,
    min_distance: float = 0.0,
) -> tuple[list[str], list[str]]:
    """Add, then drop, hubs so the tour clears target in as little time.

    The colony only trades risk against time, so its best tour can land
    well short of or well past the wanted coverage. When the target is out
    of reach the tour keeps the most coverage the hubs allow.
    """
    high_risk = _high_risk_nodes(graph)
    unchanged = (waypoint_path, expanded_path)
    if target is None or not high_risk:
        return unchanged
    tour = _score_tour(graph, distance_matrix, high_risk, waypoint_path)
    if tour is None:
        return unchanged
    needed = math.ceil(target * len(high_risk) - 1e-9)
    tour = _add_hubs(
        graph, distance_matrix, high_risk, waypoint_ids, tour, needed,
    )
    needed = min(needed, tour.covered_count)
    tour = _shorten_order(graph, distance_matrix, high_risk, tour, needed)
    tour = _drop_hubs(
        graph,
        distance_matrix,
        high_risk,
        tour,
        needed,
        avoid or [],
        min_distance,
    )
    tour = _shorten_order(graph, distance_matrix, high_risk, tour, needed)
    return tour.hubs, tour.path


def edge_set(path: list[str]) -> set[tuple[str, str]]:
    return set(zip(path, path[1:]))


def route_distance(path_a: list[str], path_b: list[str]) -> float:
    """1 - Jaccard over the segments actually driven, in [0, 1].

    Measured on expanded paths. Hub sequences make two tours over the same
    stops in a different order look completely different, and covered cells
    make every good route look the same, since they all reach the hotspots.
    """
    edges_a, edges_b = edge_set(path_a), edge_set(path_b)
    union = edges_a | edges_b
    if not union:
        return 0.0
    return 1 - len(edges_a & edges_b) / len(union)


def is_sufficiently_diverse(
    candidate_path: list[str],
    prior_paths: list[list[str]],
    threshold: float,
) -> bool:
    if not edge_set(candidate_path):
        return False
    return all(
        route_distance(candidate_path, prior) >= threshold
        for prior in prior_paths
    )


NO_TOUR_FOUND = "no_tour_found"
DUPLICATE_ROUTE = "duplicate_route"


@dataclass
class RoutePlan:
    routes: list[PlannedRoute]
    shortfall: str | None = None


def _run_phase_with_retries(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    waypoint_ids: list[str],
    start_node_id: str,
    end_node_id: str,
    pheromones: dict,
    n_iter: int,
    config: ACOConfig,
    rng: random.Random,
    accepted_expanded_paths: list[list[str]],
    seed_tour: tuple[list[str], list[str], float, float, float] | None = None,
) -> tuple[list[str], list[str], float, dict]:
    """Run a phase, penalising and retrying while it repeats an accepted route.

    Returns the last attempt either way. A candidate that is merely similar
    is still worth offering, so judging it is left to the caller.
    """
    best: tuple[list[str], list[str], float, dict] | None = None
    for attempt in range(config.diversity_retries + 1):
        waypoint_path, expanded_path, candidate_risk, pheromones = run_phase(
            graph,
            distance_matrix,
            waypoint_ids,
            start_node_id,
            end_node_id,
            pheromones,
            n_iter,
            config,
            rng,
            seed_tour=seed_tour if attempt == 0 else None,
        )
        best = (waypoint_path, expanded_path, candidate_risk, pheromones)
        if not waypoint_path:
            break
        if is_sufficiently_diverse(
            expanded_path,
            accepted_expanded_paths,
            config.diversity_threshold,
        ):
            break
        if attempt < config.diversity_retries:
            pheromones = apply_partial_penalty(
                pheromones,
                waypoint_path,
                config,
            )
    return best


def plan_routes(
    graph: ParkGraph,
    start_node_id: str,
    end_node_id: str,
    num_alternatives: int = 3,
    config: ACOConfig | None = None,
) -> RoutePlan:
    config = config or ACOConfig()

    rng = random.Random(config.seed)
    waypoint_ids = [
        w
        for w in select_waypoints(graph, limit=config.max_waypoints)
        if w not in (start_node_id, end_node_id)
    ]
    hub_ids = list(dict.fromkeys([start_node_id, end_node_id, *waypoint_ids]))
    distance_matrix = build_waypoint_distance_matrix(graph, hub_ids)
    seed_tour = None
    if config.seed_with_greedy:
        seed_tour = greedy_tour(
            graph,
            distance_matrix,
            waypoint_ids,
            start_node_id,
            end_node_id,
            config,
        )
    pheromones = init_pheromones(distance_matrix, config)
    iterations_per_phase = [
        int(config.total_iterations * f)
        for f in config.phase_split[:num_alternatives]
    ]
    accepted_waypoint_paths: list[list[str]] = []
    accepted_expanded_paths: list[list[str]] = []
    shortfalls: list[str] = []
    reference_coverage = 1.0
    for n_iter, tier in zip(iterations_per_phase, config.coverage_tiers):
        phase = _run_phase_with_retries(
            graph,
            distance_matrix,
            waypoint_ids,
            start_node_id,
            end_node_id,
            pheromones,
            n_iter,
            config,
            rng,
            accepted_expanded_paths,
            seed_tour=seed_tour if not accepted_expanded_paths else None,
        )
        waypoint_path, expanded_path, _, pheromones = phase
        if not waypoint_path:
            shortfalls.append(NO_TOUR_FOUND)
            continue
        waypoint_path, expanded_path = meet_coverage_target(
            graph,
            distance_matrix,
            waypoint_ids,
            waypoint_path,
            expanded_path,
            None if tier is None else tier * reference_coverage,
            accepted_expanded_paths,
            config.min_diversity,
        )
        distance = min(
            (
                route_distance(expanded_path, prior)
                for prior in accepted_expanded_paths
            ),
            default=1.0,
        )
        if distance < config.min_diversity:
            shortfalls.append(DUPLICATE_ROUTE)
            continue
        if not accepted_expanded_paths:
            reference_coverage = compute_risk_coverage(graph, expanded_path)
        accepted_waypoint_paths.append(waypoint_path)
        accepted_expanded_paths.append(expanded_path)
        pheromones = apply_partial_penalty(pheromones, waypoint_path, config)
    routes = [
        _to_planned_route(graph, p, compute_risk_coverage(graph, p))
        for p in accepted_expanded_paths
        if len(p) > 1
    ]
    shortfall = shortfalls[0] if len(routes) < num_alternatives else None
    return RoutePlan(routes=routes, shortfall=shortfall)


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
        risk_coverage=risk_coverage,
    )
