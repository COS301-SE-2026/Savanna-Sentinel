import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.repositories.terrain_repository import TerrainRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.workers.celery_app import celery_app
from app.workers.terrain.effects import compute_cell_effects
from app.workers.terrain.grid import load_projected_cells
from app.workers.terrain.hashing import rules_projection_hash
from app.workers.terrain.rules import resolve_feature_rules

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_TaskSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


async def _read_workspace() -> tuple[int, dict]:
    async with _TaskSessionLocal() as session:
        await session.connection(
            execution_options={"isolation_level": "REPEATABLE READ"},
        )
        workspace = WorkspaceRepository(session)
        return await workspace.get_version(), await workspace.load_snapshot()


async def _compute() -> dict:
    version, snapshot = await _read_workspace()
    resolved = resolve_feature_rules(snapshot)

    try:
        cells, epsg = load_projected_cells()
    except FileNotFoundError:
        if resolved:
            return {"status": "skipped", "reason": "no_grid"}
        cells, epsg = [], 0

    computed_hash = rules_projection_hash(snapshot["features"], resolved)
    effects = compute_cell_effects(
        cells,
        epsg,
        snapshot["features"],
        resolved,
    )

    async with _TaskSessionLocal() as session:
        applied = await TerrainRepository(session).replace_effects(
            effects,
            computed_hash,
            version,
        )
        if not applied:
            return {"status": "superseded"}
        return {"status": "completed", "n_cells": len(effects)}


@celery_app.task(name="terrain.compute_effects")
def compute_terrain_effects() -> dict:
    return asyncio.run(_compute())
