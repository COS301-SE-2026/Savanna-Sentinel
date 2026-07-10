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