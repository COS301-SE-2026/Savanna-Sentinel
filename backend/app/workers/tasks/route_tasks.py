import asyncio
from dataclasses import dataclass, field

from shapely.geometry import Point
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.repositories.route_repository import (
    build_park_graph,
    find_nearest_node,
)
from app.repositories.terrain_repository import TerrainRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.route import PlannedRoute
from app.workers.celery_app import celery_app
from app.workers.ml.route_planner import (
    STOP_IN_NO_GO,
    ACOConfig,
    RoutePlan,
    plan_routes_via,
)
from app.workers.ml.terrain_constraints import (
    TerrainConstraints,
    build_constraints,
)
from app.workers.ml.terrain_paths import FollowLine, followable_lines
from app.workers.terrain.grid import load_projected_cells
from app.workers.terrain.rules import resolve_feature_rules

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_TaskSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


@dataclass(frozen=True)
class RouteTerrain:
    route_costs: dict[str, float] = field(default_factory=dict)
    constraints: TerrainConstraints = field(default_factory=TerrainConstraints)
    cells: list = field(default_factory=list)
    paths: list[FollowLine] = field(default_factory=list)
    terrain_key: str = ""
    stale: bool = False


async def _read_terrain() -> tuple:
    async with _TaskSessionLocal() as session:
        await session.connection(
            execution_options={"isolation_level": "REPEATABLE READ"},
        )
        workspace = WorkspaceRepository(session)
        terrain = TerrainRepository(session)
        return (
            await workspace.get_version(),
            await workspace.load_snapshot(),
            await terrain.get_effects(),
            await terrain.get_meta(),
        )


def _load_terrain() -> RouteTerrain:
    """Read-only view of the workspace rules and computed terrain effects.

    Impassable areas and preferred lines come from the live workspace, so
    they are never stale.
    Cost multipliers come from the last terrain recompute, which may lag.
    """
    version, snapshot, effects, meta = asyncio.run(_read_terrain())
    cells, epsg = load_projected_cells()
    resolved = resolve_feature_rules(snapshot)
    return RouteTerrain(
        route_costs={ref: route for ref, _, route in effects},
        constraints=build_constraints(
            cells,
            epsg,
            snapshot["features"],
            resolved,
        ),
        cells=cells,
        paths=followable_lines(snapshot["features"], resolved, epsg),
        terrain_key=f"{version}:{meta['computed_hash']}",
        stale=meta["requested_hash"] != meta["computed_hash"],
    )


def _stop_in_no_go(terrain: RouteTerrain, point: tuple[float, float]) -> bool:
    constraints = terrain.constraints
    if not constraints.areas:
        return False
    xy = constraints.to_grid(point)
    spot = Point(xy)
    cell_ref = next(
        (ref for ref, cell in terrain.cells if cell.covers(spot)),
        None,
    )
    return constraints.blocks_point(xy, cell_ref)


def _serialize_route(route: PlannedRoute) -> dict:
    return {
        "suggested_path": route.suggested_path,
        "path_geometry": route.path_geometry.model_dump(),
        "distance_km": route.distance_km,
        "risk_coverage": route.risk_coverage,
    }


def _result(
    park_id: str,
    num_alternatives: int,
    plan: RoutePlan,
    terrain: RouteTerrain,
) -> dict:
    return {
        "park_id": park_id,
        "num_alternatives_requested": num_alternatives,
        "num_alternatives_found": len(plan.routes),
        "shortfall_reason": plan.shortfall,
        "terrain_stale": terrain.stale,
        "results": [_serialize_route(r) for r in plan.routes],
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
    terrain = _load_terrain()
    graph = build_park_graph(
        park_id,
        risk_by_cell,
        route_cost_by_cell=terrain.route_costs,
        constraints=terrain.constraints,
        terrain_key=terrain.terrain_key,
        paths=terrain.paths,
    )
    stops = [start, *(waypoints or []), end]
    if any(_stop_in_no_go(terrain, point) for point in stops):
        plan = RoutePlan(routes=[], shortfall=STOP_IN_NO_GO)
        return _result(park_id, num_alternatives, plan, terrain)

    stop_node_ids = [
        find_nearest_node(graph, point, terrain.constraints) for point in stops
    ]

    plan = plan_routes_via(
        graph,
        stop_node_ids,
        num_alternatives,
        ACOConfig(seed=seed),
    )
    return _result(park_id, num_alternatives, plan, terrain)
