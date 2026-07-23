import asyncio

from app.repositories.route_repository import (
    build_park_graph,
    find_nearest_node,
)
from app.schemas.route import PlannedRoute
from app.workers.celery_app import celery_app
from app.workers.ml.route_planner import ACOConfig, plan_routes


def _serialize_route(route: PlannedRoute) -> dict:
    return {
        "suggested_path": route.suggested_path,
        "path_geometry": route.path_geometry.model_dump(),
        "estimated_time_min": route.estimated_time_min,
        "estimated_fuel_l": route.estimated_fuel_l,
        "risk_coverage": route.risk_coverage,
    }


@celery_app.task(name="routes.run_route_planning_job")
def run_route_planning_job(
    park_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    max_time_min: float,
    max_fuel_l: float,
    num_alternatives: int,
) -> dict:
    """Run plan_routes() and return however many alternatives were accepted.

    Not `async def` - Celery does not await coroutine task functions, it
    just hands one back without running it. build_park_graph is the only
    async call here, bridged in with asyncio.run(). Job status/progress is
    read from this task's own Celery result state (see get_routes) - there
    is no separate persisted RouteJob record.
    """
    graph = asyncio.run(build_park_graph(None, park_id))
    start_node_id = find_nearest_node(graph, start)
    end_node_id = find_nearest_node(graph, end)

    routes = plan_routes(
        graph,
        start_node_id,
        end_node_id,
        max_time_min,
        max_fuel_l,
        num_alternatives,
        ACOConfig(),
    )

    return {
        "park_id": park_id,
        "num_alternatives_requested": num_alternatives,
        "num_alternatives_found": len(routes),
        "results": [_serialize_route(r) for r in routes],
    }
