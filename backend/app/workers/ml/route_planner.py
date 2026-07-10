from dataclasses import dataclass
import random
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
    quality_threshold: float = 0.9  #candidate must retain >= 90% of best risk_coverage

def init_pheromones(graph: ParkGraph, config: ACOConfig) -> dict[tuple[str, str], float]:
    return {(e.from_node_id, e.to_node_id): config.tau_max for e in graph.edges}

def estimate_return_cost(graph: ParkGraph, node_id: str, end_node_id: str) -> tuple[float, float]:
    """Straight-line lower-bound estimate of (time, fuel) still needed to reach end_node_id."""
    ...

def feasible_edges(
    graph: ParkGraph, current_node: str, end_node_id: str, visited: set[str],
    time_remaining: float, fuel_remaining: float,
) -> list[GraphEdge]:
    candidates = []
    for e in graph.edges:
        if e.from_node_id != current_node or e.to_node_id in visited:
            continue
        time_left_after = time_remaining - e.est_time_min
        fuel_left_after = fuel_remaining - e.est_fuel_l
        if time_left_after < 0 or fuel_left_after < 0:
            continue
        est_return_time, est_return_fuel = estimate_return_cost(graph, e.to_node_id, end_node_id)
        if est_return_time > time_left_after or est_return_fuel > fuel_left_after:
            continue
        candidates.append(e)
    return candidates

def select_next_edge(candidates: list[GraphEdge], pheromones: dict, graph: ParkGraph, config: ACOConfig,) -> GraphEdge | None:
    if not candidates:
        return None
    node_risk = {n.node_id: n.risk_score for n in graph.nodes}
    weights = []
    for e in candidates:
        tau = pheromones.get((e.from_node_id, e.to_node_id), config.tau_min)
        heuristic = (node_risk.get(e.to_node_id, 0.0001) + 0.0001) / (e.est_time_min + e.est_fuel_l + 1)
        weights.append((tau ** config.alpha) * (heuristic ** config.beta))
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
    graph: ParkGraph, start_node_id: str, end_node_id: str,
    max_time: float, max_fuel: float, pheromones: dict, config: ACOConfig,
) -> tuple[list[str], float, float, float]:
    path, visited = [start_node_id], {start_node_id}
    time_left, fuel_left, risk_total = max_time, max_fuel, 0.0
    node_risk = {n.node_id: n.risk_score for n in graph.nodes}
    current = start_node_id
    while current != end_node_id:
        candidates = feasible_edges(graph, current, end_node_id, visited, time_left, fuel_left)
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
    pheromones: dict, best_path: list[str], best_risk: float, config: ACOConfig,
) -> dict:
    updated = {edge: max(tau * (1 - config.rho), config.tau_min) for edge, tau in pheromones.items()}
    for a, b in zip(best_path, best_path[1:]):
        deposit = updated.get((a, b), config.tau_min) + config.rho * best_risk
        updated[(a, b)] = min(deposit, config.tau_max)
    return updated

def apply_partial_penalty(pheromones: dict, used_path: list[str], config: ACOConfig) -> dict:
    penalized = dict(pheromones)
    for a, b in zip(used_path, used_path[1:]):
        current = penalized.get((a, b), config.tau_min)
        penalized[(a, b)] = max(current * config.penalty_factor, config.tau_min)
    return penalized

def run_phase(
    graph: ParkGraph, start_node_id: str, end_node_id: str,
    max_time: float, max_fuel: float, pheromones: dict,
    num_iterations: int, config: ACOConfig,
) -> tuple[list[str], float, dict]:
    best_path, best_risk = [], -1.0
    for _ in range(num_iterations):
        tours = []
        for _ in range(config.num_ants):
            path, _, _, risk = construct_tour(
                graph, start_node_id, end_node_id, max_time, max_fuel, pheromones, config
            )
            if path[-1] == end_node_id:
                tours.append((path, risk))
        if not tours:
            continue
        iter_best_path, iter_best_risk = max(tours, key=lambda t: t[1])
        pheromones = update_pheromones(pheromones, iter_best_path, iter_best_risk, config)
        if iter_best_risk > best_risk:
            best_path, best_risk = iter_best_path, iter_best_risk
    return best_path, best_risk, pheromones

def edge_set(path: list[str]) -> set[tuple[str, str]]:
    return set(zip(path, path[1:]))

def is_sufficiently_diverse(
    candidate_path: list[str], prior_paths: list[list[str]], threshold: float,
) -> bool:
    candidate_edges = edge_set(candidate_path)
    for prior in prior_paths:
        prior_edges = edge_set(prior)
        overlap_ratio = len(candidate_edges & prior_edges) / max(len(candidate_edges | prior_edges), 1)
        if (1 - overlap_ratio) < threshold:
            return False
    return True