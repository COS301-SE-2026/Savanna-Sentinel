from dataclasses import dataclass
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