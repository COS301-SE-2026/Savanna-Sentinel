import math
import random
from collections import Counter
from dataclasses import dataclass, replace

from app.schemas.geo import GeoLineString
from app.schemas.route import ParkGraph, PlannedRoute
from app.workers.ml.path_smoothing import smooth_route
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
    coverage_tiers: tuple[float | None, ...] = (1.0, 1.0, 1.0)
    max_extra_distance: float = 0.15
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


ZONE_RADIUS_STEPS = 2


def _steps_within(
    source: str,
    cells: frozenset[str],
    neighbors: dict[str, frozenset[str]],
) -> dict[str, int]:
    steps = {source: 0}
    frontier = [source]
    while frontier:
        following = []
        for cell in frontier:
            for other in neighbors.get(cell, ()):
                if other in cells and other not in steps:
                    steps[other] = steps[cell] + 1
                    following.append(other)
        frontier = following
    return steps


def _weighted_medoid(
    cells: list[str],
    steps: dict[str, dict[str, int]],
    risk: dict[str, float],
) -> str:
    return min(
        cells,
        key=lambda c: math.fsum(risk[d] * steps[c][d] for d in cells),
    )


def _split_zone(
    cells: list[str],
    neighbors: dict[str, frozenset[str]],
    risk: dict[str, float],
) -> list[list[str]]:
    members = frozenset(cells)
    steps = {c: _steps_within(c, members, neighbors) for c in cells}
    centres = [_weighted_medoid(cells, steps, risk)]
    while True:
        distance = {
            c: min(steps[centre][c] for centre in centres) for c in cells
        }
        farthest = max(cells, key=lambda c: distance[c])
        if distance[farthest] <= ZONE_RADIUS_STEPS:
            break
        centres.append(farthest)
    groups: dict[str, list[str]] = {centre: [] for centre in centres}
    for c in cells:
        nearest = min(centres, key=lambda centre: steps[centre][c])
        groups[nearest].append(c)
    return list(groups.values())


def hotspot_zones(
    graph: ParkGraph,
    threshold: float | None = None,
) -> list[tuple[str, list[str]]]:
    """(stop, cells) for each area of touching hotspot cells."""
    if threshold is None:
        threshold = high_risk_threshold(graph)
    risk = _node_risk(graph)
    neighbors = _coverage_neighbors(graph)
    order = {n.node_id: i for i, n in enumerate(graph.nodes)}
    hot = [n.node_id for n in graph.nodes if n.risk_score >= threshold]
    hot_set = frozenset(hot)
    seen: set[str] = set()
    zones = []
    for cell in hot:
        if cell in seen:
            continue
        area = sorted(
            _steps_within(cell, hot_set, neighbors),
            key=order.__getitem__,
        )
        seen.update(area)
        for group in _split_zone(area, neighbors, risk):
            members = frozenset(group)
            steps = {c: _steps_within(c, members, neighbors) for c in group}
            zones.append((_weighted_medoid(group, steps, risk), group))
    zones.sort(
        key=lambda z: (-math.fsum(risk[c] for c in z[1]), order[z[0]]),
    )
    return zones


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
    covered: frozenset[str] | set[str] = frozenset(),
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
            covered,
        )
        if chosen is None:
            break
        hop = distance_matrix[(current, chosen)]
        time_used += hop.time_min
        # Union the whole hop's coverage before diffing against covered,
        # so an earlier node's radius cant shadow a later node's credit
        # based on loop order.
        hop_covered = _hop_coverage(graph, hop)
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
    scored = _evaluate_hubs(graph, distance_matrix, sequence)
    return None if scored is None else scored[:3]


def _hop_coverage(graph: ParkGraph, hop: PathResult) -> set[str]:
    # built exactly as before, so set order and risk sums are unchanged
    cache = getattr(graph, "_hop_coverage_cache", None)
    if cache is None:
        cache = {}
        graph._hop_coverage_cache = cache
    entry = cache.get(id(hop))
    if entry is not None and entry[0] is hop:
        return entry[1]
    coverage_neighbors = _coverage_neighbors(graph)
    hop_covered: set[str] = set()
    for node_id in hop.path[1:]:
        hop_covered |= coverage_neighbors.get(node_id, {node_id})
    cache[id(hop)] = (hop, hop_covered)
    return hop_covered


def _evaluate_hubs(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
) -> tuple[list[str], float, float, set[str]] | None:
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
        hop_covered = _hop_coverage(graph, hop)
        risk_total += sum(node_risk.get(n, 0.0) for n in hop_covered - covered)
        covered |= hop_covered
        expanded.extend(hop.path[1:])
    return expanded, time_used, risk_total, covered


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


# estimates only skip clearly-worse moves, the rest get exact times
SEQUENCE_TIME_MARGIN = 1e-6
REVERSE_TIME_TOLERANCE = 1e-9


def _hop_time(
    distance_matrix: dict[tuple[str, str], PathResult],
    a: str,
    b: str,
) -> float:
    hop = distance_matrix.get((a, b))
    return math.inf if hop is None else hop.time_min


def _reversible(
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
) -> bool:
    for a, b in zip(sequence, sequence[1:]):
        forward = distance_matrix.get((a, b))
        back = distance_matrix.get((b, a))
        if forward is None or back is None:
            return False
        if abs(forward.time_min - back.time_min) > REVERSE_TIME_TOLERANCE:
            return False
    return True


def _two_opt_moves(
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
):
    # only boundary hops change when the segment costs the same reversed
    estimate = _reversible(distance_matrix, sequence)
    for i in range(1, len(sequence) - 2):
        before, first = sequence[i - 1], sequence[i]
        for j in range(i + 1, len(sequence) - 1):
            if not estimate:
                yield None, i, j
                continue
            last, after = sequence[j], sequence[j + 1]
            yield (
                _hop_time(distance_matrix, before, last)
                + _hop_time(distance_matrix, first, after)
                - _hop_time(distance_matrix, before, first)
                - _hop_time(distance_matrix, last, after)
            ), i, j


def _apply_two_opt(sequence: list[str], i: int, j: int) -> list[str]:
    return sequence[:i] + sequence[i : j + 1][::-1] + sequence[j + 1 :]


def _or_opt_moves(
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
):
    for i in range(1, len(sequence) - 1):
        left, moved, right = sequence[i - 1], sequence[i], sequence[i + 1]
        removal = (
            _hop_time(distance_matrix, left, right)
            - _hop_time(distance_matrix, left, moved)
            - _hop_time(distance_matrix, moved, right)
        )
        without = sequence[:i] + sequence[i + 1 :]
        for j in range(1, len(without)):
            if j == i:
                continue
            a, b = without[j - 1], without[j]
            yield removal + (
                _hop_time(distance_matrix, a, moved)
                + _hop_time(distance_matrix, moved, b)
                - _hop_time(distance_matrix, a, b)
            ), i, j


def _apply_or_opt(sequence: list[str], i: int, j: int) -> list[str]:
    without = sequence[:i] + sequence[i + 1 :]
    return without[:j] + [sequence[i]] + without[j:]


HUB_MOVES = ((_two_opt_moves, _apply_two_opt), (_or_opt_moves, _apply_or_opt))


def _clearly_not_below(
    base_time: float | None,
    delta: float | None,
    bound: float,
) -> bool:
    if base_time is None or delta is None:
        return False
    return base_time + delta >= bound + SEQUENCE_TIME_MARGIN


def improve_hub_sequence(
    distance_matrix: dict[tuple[str, str], PathResult],
    sequence: list[str],
    moves=HUB_MOVES,
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
        for move, apply_move in moves:
            start, start_time = best, best_time
            for delta, i, j in move(distance_matrix, start):
                if _clearly_not_below(start_time, delta, best_time):
                    continue
                candidate = apply_move(start, i, j)
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


COVERAGE_EPS = 1e-9
MAX_SPUR_CELLS = 60


def compute_risk_coverage(
    graph: ParkGraph,
    path: list[str],
    threshold: float | None = None,
) -> float:
    """Share of the grid's hotspot risk the path covers, in [0, 1]."""
    weights = _hotspot_weights(graph, threshold)
    total = math.fsum(weights.values())
    if total <= 0:
        return 0.0
    return _covered_weight(weights, covered_nodes(graph, path)) / total


def _hotspot_weights(
    graph: ParkGraph,
    threshold: float | None = None,
) -> dict[str, float]:
    if threshold is not None:
        return {
            nid: score for nid, score in _node_risk(graph).items()
            if score >= threshold
        }
    cached = getattr(graph, "_hotspot_weights_cache", None)
    if cached is None:
        cached = _hotspot_weights(graph, high_risk_threshold(graph))
        graph._hotspot_weights_cache = cached
    return cached


def _covered_weight(weights: dict[str, float], covered) -> float:
    return math.fsum(weights[c] for c in covered if c in weights)


QUICK_EFFORT_MARGIN = 1e-6
TURN_PENALTY_MIN_PER_RAD = 4.0
FREE_TURN_RAD = math.pi / 4
REVISIT_PENALTY_MIN = 3.0


def _node_locations(graph: ParkGraph) -> dict[str, tuple[float, float]]:
    cached = getattr(graph, "_node_locations_cache", None)
    if cached is None:
        cached = {n.node_id: n.location.coordinates for n in graph.nodes}
        graph._node_locations_cache = cached
    return cached


def _turn_angle(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
) -> float:
    scale = math.cos(math.radians(b[1]))
    ux, uy = (b[0] - a[0]) * scale, b[1] - a[1]
    vx, vy = (c[0] - b[0]) * scale, c[1] - b[1]
    return abs(math.atan2(ux * vy - uy * vx, ux * vx + uy * vy))


def route_effort(graph: ParkGraph, path: list[str], time_used: float) -> float:
    """Drive time plus a charge for sharp turns and re-driven cells."""
    at = _node_locations(graph)
    turning = math.fsum(
        max(_turn_angle(at[a], at[b], at[c]) - FREE_TURN_RAD, 0.0)
        for a, b, c in zip(path, path[1:], path[2:])
        if a != b and b != c
    )
    revisits = len(path) - len(set(path))
    return (
        time_used
        + TURN_PENALTY_MIN_PER_RAD * turning
        + REVISIT_PENALTY_MIN * revisits
    )


def _turn_terms(graph: ParkGraph, path: list[str]) -> tuple[float, ...]:
    at = _node_locations(graph)
    return tuple(
        max(_turn_angle(at[a], at[b], at[c]) - FREE_TURN_RAD, 0.0)
        for a, b, c in zip(path, path[1:], path[2:])
        if a != b and b != c
    )


def _hop_turn_terms(graph: ParkGraph, hop: PathResult) -> tuple[float, ...]:
    cache = getattr(graph, "_hop_turn_terms_cache", None)
    if cache is None:
        cache = {}
        graph._hop_turn_terms_cache = cache
    entry = cache.get(id(hop))
    if entry is not None and entry[0] is hop:
        return entry[1]
    terms = _turn_terms(graph, hop.path)
    cache[id(hop)] = (hop, terms)
    return terms


def _joint_turn_terms(
    graph: ParkGraph,
    joint: tuple[str, str, str],
) -> tuple[float, ...]:
    cache = getattr(graph, "_joint_turn_terms_cache", None)
    if cache is None:
        cache = {}
        graph._joint_turn_terms_cache = cache
    terms = cache.get(joint)
    if terms is None:
        terms = _turn_terms(graph, list(joint))
        cache[joint] = terms
    return terms


def _hop_turning(graph: ParkGraph, hop: PathResult) -> float:
    cache = getattr(graph, "_hop_turning_cache", None)
    if cache is None:
        cache = {}
        graph._hop_turning_cache = cache
    entry = cache.get(id(hop))
    if entry is not None and entry[0] is hop:
        return entry[1]
    turning = math.fsum(_hop_turn_terms(graph, hop))
    cache[id(hop)] = (hop, turning)
    return turning


def _effort_floor(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    hubs: list[str],
) -> float | None:
    # lower bound on _quick_effort (no revisits), O(hubs)
    time_used = turning = 0.0
    prev = None
    for a, b in zip(hubs, hubs[1:]):
        hop = distance_matrix.get((a, b))
        if hop is None:
            return None
        time_used += hop.time_min
        turning += _hop_turning(graph, hop)
        if prev is not None:
            joint = (prev.path[-2], prev.path[-1], hop.path[1])
            turning += sum(_joint_turn_terms(graph, joint))
        prev = hop
    return time_used + TURN_PENALTY_MIN_PER_RAD * turning


def _quick_effort(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    hubs: list[str],
) -> float | None:
    # route_effort from cached per-hop and hub-joint turns
    hops = []
    time_used = 0.0
    for a, b in zip(hubs, hubs[1:]):
        hop = distance_matrix.get((a, b))
        if hop is None:
            return None
        time_used += hop.time_min
        hops.append(hop)
    if not hops:
        return None
    pieces = [_hop_turn_terms(graph, hop) for hop in hops]
    for prev, nxt in zip(hops, hops[1:]):
        joint = (prev.path[-2], prev.path[-1], nxt.path[1])
        pieces.append(_joint_turn_terms(graph, joint))
    turning = math.fsum(t for piece in pieces for t in piece)
    nodes = {hubs[0]}
    length = 1
    for hop in hops:
        nodes.update(hop.path[1:])
        length += len(hop.path) - 1
    return (
        time_used
        + TURN_PENALTY_MIN_PER_RAD * turning
        + REVISIT_PENALTY_MIN * (length - len(nodes))
    )


@dataclass
class _ScoredTour:
    hubs: list[str]
    path: list[str]
    time: float
    risk: float
    covered: float
    effort: float


def _score_tour(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    weights: dict[str, float],
    hubs: list[str],
) -> _ScoredTour | None:
    scored = _evaluate_hubs(graph, distance_matrix, hubs)
    if scored is None:
        return None
    path, time_used, risk_total, covered_cells = scored
    covered = _covered_weight(weights, covered_cells)
    effort = route_effort(graph, path, time_used)
    return _ScoredTour(hubs, path, time_used, risk_total, covered, effort)


ORDER_SLACK = 0.02


def _cheapest_insertion(
    distance_matrix: dict[tuple[str, str], PathResult],
    hubs: list[str],
    stop: str,
) -> list[str] | None:
    base_time = _sequence_time(distance_matrix, hubs)
    best, best_time = None, math.inf
    for position in range(1, len(hubs)):
        left, right = hubs[position - 1], hubs[position]
        delta = (
            _hop_time(distance_matrix, left, stop)
            + _hop_time(distance_matrix, stop, right)
            - _hop_time(distance_matrix, left, right)
        )
        if _clearly_not_below(base_time, delta, best_time):
            continue
        candidate = hubs[:position] + [stop] + hubs[position:]
        time_used = _sequence_time(distance_matrix, candidate)
        if time_used is not None and time_used < best_time:
            best, best_time = candidate, time_used
    return best


def _reordered(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    weights: dict[str, float],
    tour: _ScoredTour,
    floor: float,
) -> _ScoredTour:
    hubs = improve_hub_sequence(distance_matrix, tour.hubs)
    if hubs == tour.hubs:
        return tour
    candidate = _score_tour(graph, distance_matrix, weights, hubs)
    if candidate is None or candidate.covered < floor - COVERAGE_EPS:
        return tour
    return candidate


def _add_hubs(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    weights: dict[str, float],
    waypoint_ids: list[str],
    tour: _ScoredTour,
    needed: float,
    slack: float,
) -> _ScoredTour:
    while tour.covered < needed - COVERAGE_EPS:
        best, best_value = None, 0.0
        for stop in waypoint_ids:
            if stop in tour.hubs:
                continue
            hubs = _cheapest_insertion(distance_matrix, tour.hubs, stop)
            candidate = hubs and _score_tour(
                graph, distance_matrix, weights, hubs,
            )
            if candidate is None:
                continue
            gain = candidate.covered - tour.covered
            value = gain / (max(candidate.time - tour.time, 0.0) + 1.0)
            if gain > COVERAGE_EPS and value > best_value:
                best, best_value = candidate, value
        if best is None:
            return tour
        tour = _reordered(
            graph, distance_matrix, weights, best, best.covered - slack,
        )
    return tour


def _drop_hubs(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    weights: dict[str, float],
    tour: _ScoredTour,
    needed: float,
    slack: float,
    avoid: list[list[str]],
    min_distance: float,
) -> _ScoredTour:
    while True:
        best = None
        for i in range(1, len(tour.hubs) - 1):
            candidate = _score_tour(
                graph,
                distance_matrix,
                weights,
                tour.hubs[:i] + tour.hubs[i + 1:],
            )
            if (
                candidate is None
                or candidate.covered < needed - slack - COVERAGE_EPS
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
        tour = _reordered(
            graph, distance_matrix, weights, best, needed - slack,
        )


def _first_smoother_order(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    weights: dict[str, float],
    tour: _ScoredTour,
    floor: float,
) -> _ScoredTour | None:
    base_time = _sequence_time(distance_matrix, tour.hubs)
    for move, apply_move in HUB_MOVES:
        for delta, i, j in move(distance_matrix, tour.hubs):
            if _clearly_not_below(base_time, delta, tour.effort - COVERAGE_EPS):
                continue
            hubs = apply_move(tour.hubs, i, j)
            time_used = _sequence_time(distance_matrix, hubs)
            if time_used is None or time_used >= tour.effort - COVERAGE_EPS:
                continue
            # skip clearly-worse effort before the full score
            too_much = tour.effort - COVERAGE_EPS + QUICK_EFFORT_MARGIN
            least_effort = _effort_floor(graph, distance_matrix, hubs)
            if least_effort is None or least_effort >= too_much:
                continue
            effort = _quick_effort(graph, distance_matrix, hubs)
            if effort is None or effort >= too_much:
                continue
            candidate = _score_tour(graph, distance_matrix, weights, hubs)
            if (
                candidate is not None
                and candidate.covered >= floor - COVERAGE_EPS
                and candidate.effort < tour.effort - COVERAGE_EPS
            ):
                return candidate
    return None


def _smooth_order(
    graph: ParkGraph,
    distance_matrix: dict[tuple[str, str], PathResult],
    weights: dict[str, float],
    tour: _ScoredTour,
    floor: float,
) -> _ScoredTour:
    while True:
        smoother = _first_smoother_order(
            graph, distance_matrix, weights, tour, floor,
        )
        if smoother is None:
            return tour
        tour = smoother


def _edge_times(graph: ParkGraph) -> dict[tuple[str, str], float]:
    cached = getattr(graph, "_edge_times_cache", None)
    if cached is None:
        cached = {
            (e.from_node_id, e.to_node_id): e.est_time_min for e in graph.edges
        }
        graph._edge_times_cache = cached
    return cached


def _path_time(times: dict[tuple[str, str], float], path: list[str]) -> float:
    return math.fsum(times[pair] for pair in zip(path, path[1:]))


@dataclass
class _SpurContext:
    times: dict[tuple[str, str], float]
    contributions: dict[str, frozenset[str]]
    weights: dict[str, float]


def _fold_spur(
    path: list[str],
    i: int,
    ctx: _SpurContext,
    counts: Counter,
    spare: float,
) -> tuple[list[str], int] | None:
    anchor = path[i]
    j = next(
        (
            j
            for j in range(min(i + MAX_SPUR_CELLS, len(path) - 1), i + 2, -1)
            if path[j] != anchor and (anchor, path[j]) in ctx.times
        ),
        None,
    )
    if j is None:
        return None
    elapsed = [0.0]
    for pair in zip(path[i:j], path[i + 1 : j + 1]):
        elapsed.append(elapsed[-1] + ctx.times[pair])
    link = ctx.times[(anchor, path[j])]
    removed: Counter = Counter()
    lost = 0.0
    best = None
    for k in range(j - 1, i - 1, -1):
        if k < j - 1:
            for cell in ctx.contributions[path[k + 1]]:
                removed[cell] += 1
                if removed[cell] == counts[cell]:
                    lost += ctx.weights[cell]
        if lost > spare + COVERAGE_EPS:
            break
        if 2 * elapsed[k - i] + link < elapsed[-1] - COVERAGE_EPS:
            best = k
    if best is None:
        return None
    back = path[i:best][::-1]
    return path[: best + 1] + back + path[j:], best + len(back) + 1


def _fold_spurs(
    graph: ParkGraph,
    path: list[str],
    weights: dict[str, float],
    needed: float,
    avoid: list[list[str]],
    min_distance: float,
) -> list[str]:
    neighbors = _coverage_neighbors(graph)
    ctx = _SpurContext(
        times=_edge_times(graph),
        contributions={
            n: frozenset(c for c in neighbors.get(n, {n}) if c in weights)
            for n in set(path)
        },
        weights=weights,
    )
    i = 0
    while i < len(path) - 4:
        counts: Counter = Counter()
        for node_id in path:
            counts.update(ctx.contributions[node_id])
        spare = _covered_weight(weights, counts) - needed
        folded = _fold_spur(path, i, ctx, counts, spare)
        if folded is None or any(
            route_distance(folded[0], prior) < min_distance for prior in avoid
        ):
            i += 1
            continue
        path, i = folded
    return path


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
    """Pick the zones to visit for target, then the best order for them."""
    weights = _hotspot_weights(graph)
    total = math.fsum(weights.values())
    unchanged = (waypoint_path, expanded_path)
    if target is None or total <= 0:
        return unchanged
    tour = _score_tour(graph, distance_matrix, weights, waypoint_path)
    if tour is None:
        return unchanged
    slack = ORDER_SLACK * total
    tour = _reordered(graph, distance_matrix, weights, tour, 0.0)
    needed = target * total
    tour = _add_hubs(
        graph, distance_matrix, weights, waypoint_ids, tour, needed, slack,
    )
    needed = min(needed, tour.covered)
    avoid = avoid or []
    tour = _drop_hubs(
        graph,
        distance_matrix,
        weights,
        tour,
        needed,
        slack,
        avoid,
        min_distance,
    )
    tour = _smooth_order(
        graph, distance_matrix, weights, tour, needed - slack,
    )
    path = _fold_spurs(
        graph,
        tour.path,
        weights,
        min(needed, tour.covered),
        avoid,
        min_distance,
    )
    return tour.hubs, path


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
LONGER_THAN_BEST = "longer_than_best"


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
    reshape=None,
) -> tuple[list[str], list[str], float, dict]:
    """Run a phase, penalising and retrying while it repeats an accepted route.

    Diversity is judged on the reshaped tour, since reshaping can pull two
    different colony tours onto the same route. Returns the last attempt
    either way; a merely similar candidate is left to the caller to judge.
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
        if waypoint_path and reshape is not None:
            waypoint_path, expanded_path = reshape(waypoint_path, expanded_path)
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
    hotspot_ids: set[str] | None = None,
) -> RoutePlan:
    config = config or ACOConfig()

    rng = random.Random(config.seed)
    waypoint_ids = [
        stop
        for stop, cells in hotspot_zones(graph)[: config.max_waypoints]
        if start_node_id not in cells
        and end_node_id not in cells
        and (hotspot_ids is None or stop in hotspot_ids)
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
    tier_scale = 1.0
    for n_iter, tier in zip(iterations_per_phase, config.coverage_tiers):
        target = None if tier is None else tier * tier_scale

        def reshape(waypoint_path, expanded_path, target=target):
            return meet_coverage_target(
                graph,
                distance_matrix,
                waypoint_ids,
                waypoint_path,
                expanded_path,
                target,
                accepted_expanded_paths,
                config.min_diversity,
            )

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
            reshape=reshape,
        )
        waypoint_path, expanded_path, _, pheromones = phase
        if not waypoint_path:
            shortfalls.append(NO_TOUR_FOUND)
            continue
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
        if not accepted_expanded_paths and tier:
            reached = compute_risk_coverage(graph, expanded_path)
            tier_scale = min(1.0, reached / tier)
        accepted_waypoint_paths.append(waypoint_path)
        accepted_expanded_paths.append(expanded_path)
        pheromones = apply_partial_penalty(pheromones, waypoint_path, config)
    routes = sorted(
        (
            _to_planned_route(graph, p, compute_risk_coverage(graph, p))
            for p in accepted_expanded_paths
            if len(p) > 1
        ),
        key=lambda r: r.distance_km,
    )
    if routes:
        limit = routes[0].distance_km * (1 + config.max_extra_distance)
        close = [r for r in routes if r.distance_km <= limit + COVERAGE_EPS]
        if len(close) < len(routes):
            shortfalls.append(LONGER_THAN_BEST)
        routes = close
    shortfall = shortfalls[0] if len(routes) < num_alternatives else None
    return RoutePlan(routes=routes, shortfall=shortfall)


MIN_LEG_ITERATIONS = 40


def assign_hotspots_to_legs(
    distance_matrix: dict[tuple[str, str], PathResult],
    stop_ids: list[str],
    hotspot_ids: list[str],
) -> list[list[str]]:
    """Give each hotspot to the one leg it adds the least time to."""
    legs: list[list[str]] = [[] for _ in stop_ids[1:]]
    for hub in hotspot_ids:
        best_leg, best_detour = None, math.inf
        for i, (a, b) in enumerate(zip(stop_ids, stop_ids[1:])):
            to_hub = distance_matrix.get((a, hub))
            from_hub = distance_matrix.get((hub, b))
            if to_hub is None or from_hub is None:
                continue
            direct = distance_matrix.get((a, b))
            detour = to_hub.time_min + from_hub.time_min - (
                direct.time_min if direct else 0.0
            )
            if detour < best_detour:
                best_leg, best_detour = i, detour
        if best_leg is not None:
            legs[best_leg].append(hub)
    return legs


def _stitch_legs(leg_plans: list[RoutePlan], k: int) -> list[str]:
    path: list[str] = []
    for plan in leg_plans:
        leg = plan.routes[min(k, len(plan.routes) - 1)].suggested_path
        path.extend(leg if not path else leg[1:])
    return path


def plan_routes_via(
    graph: ParkGraph,
    stop_node_ids: list[str],
    num_alternatives: int = 3,
    config: ACOConfig | None = None,
) -> RoutePlan:
    """Plan through the user's stops in order, one leg at a time.

    Alternative k joins every leg's k-th route, falling back to a leg's
    best route when that leg found fewer alternatives.
    """
    config = config or ACOConfig()
    if len(stop_node_ids) == 2:
        return plan_routes(
            graph, stop_node_ids[0], stop_node_ids[1], num_alternatives, config,
        )

    stops = [
        node
        for i, node in enumerate(stop_node_ids)
        if i == 0 or node != stop_node_ids[i - 1]
    ]
    if len(stops) < 2:
        return plan_routes(graph, stops[0], stops[0], num_alternatives, config)

    stop_set = set(stops)
    hotspot_ids = [
        hub
        for hub, cells in hotspot_zones(graph)[: config.max_waypoints]
        if stop_set.isdisjoint(cells)
    ]
    matrix = build_waypoint_distance_matrix(
        graph, list(dict.fromkeys([*stops, *hotspot_ids])),
    )
    leg_hotspots = assign_hotspots_to_legs(matrix, stops, hotspot_ids)
    leg_config = replace(
        config,
        total_iterations=max(
            MIN_LEG_ITERATIONS, config.total_iterations // (len(stops) - 1),
        ),
    )

    leg_plans: list[RoutePlan] = []
    for (a, b), hubs in zip(zip(stops, stops[1:]), leg_hotspots):
        plan = plan_routes(
            graph, a, b, num_alternatives, leg_config, hotspot_ids=set(hubs),
        )
        if not plan.routes:
            return RoutePlan(
                routes=[], shortfall=plan.shortfall or NO_TOUR_FOUND,
            )
        leg_plans.append(plan)

    paths: list[list[str]] = []
    for k in range(num_alternatives):
        path = _stitch_legs(leg_plans, k)
        if all(
            route_distance(path, prior) >= config.min_diversity
            for prior in paths
        ):
            paths.append(path)

    routes = sorted(
        (
            _to_planned_route(graph, p, compute_risk_coverage(graph, p))
            for p in paths
        ),
        key=lambda r: r.distance_km,
    )
    shortfall = None
    if len(routes) < num_alternatives:
        shortfall = next(
            (p.shortfall for p in leg_plans if p.shortfall), DUPLICATE_ROUTE,
        )
    return RoutePlan(routes=routes, shortfall=shortfall)


def _cell_size_degrees(graph: ParkGraph) -> float:
    cached = getattr(graph, "_cell_size_degrees_cache", None)
    if cached is None:
        cached = min(
            (e.distance_km for e in graph.edges if e.distance_km > 0),
            default=0.0,
        ) / KM_PER_DEGREE
        graph._cell_size_degrees_cache = cached
    return cached


def _to_planned_route(
    graph: ParkGraph,
    path: list[str],
    risk_coverage: float,
) -> PlannedRoute:
    node_lookup = {n.node_id: n for n in graph.nodes}
    edge_lookup = {(e.from_node_id, e.to_node_id): e for e in graph.edges}
    coords = [node_lookup[nid].location.coordinates for nid in path]
    smoothed = smooth_route(coords, _cell_size_degrees(graph))
    edges_used = [edge_lookup[pair] for pair in zip(path, path[1:])]
    return PlannedRoute(
        suggested_path=path,
        path_geometry=GeoLineString(coordinates=smoothed),
        distance_km=sum(e.distance_km for e in edges_used),
        risk_coverage=risk_coverage,
    )
