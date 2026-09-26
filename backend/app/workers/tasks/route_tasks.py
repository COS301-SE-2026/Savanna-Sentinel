from app.repositories.route_repository import (
    build_park_graph,
    find_nearest_node,
)
from app.schemas.route import PlannedRoute
from app.workers.celery_app import celery_app
from app.workers.ml.route_planner import ACOConfig, plan_routes_via


def _serialize_route(route: PlannedRoute) -> dict:
    return {
        "suggested_path": route.suggested_path,
        "path_geometry": route.path_geometry.model_dump(),
        "distance_km": route.distance_km,
        "risk_coverage": route.risk_coverage,
    }


@celery_app.task(name="routes.run_route_planning_job")
def run_route_planning_job(
    park_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    num_alternatives: int,
    risk_by_cell: dict[str, float] | None = None,
    seed: int | None = None,
    waypoints: list[tuple[float, float]] | None = None,
) -> dict:
    graph = build_park_graph(park_id, risk_by_cell)
    stop_node_ids = [
        find_nearest_node(graph, point)
        for point in [start, *(waypoints or []), end]
    ]

    plan = plan_routes_via(
        graph,
        stop_node_ids,
        num_alternatives,
        ACOConfig(seed=seed),
    )

    return {
        "park_id": park_id,
        "num_alternatives_requested": num_alternatives,
        "num_alternatives_found": len(plan.routes),
        "shortfall_reason": plan.shortfall,
        "results": [_serialize_route(r) for r in plan.routes],
    }
