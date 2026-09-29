import asyncio

import pytest

from app.repositories.workspace_repository import WorkspaceRepository
from app.workers.tasks import route_tasks


@pytest.mark.asyncio
async def test_route_task_reads_workspace_and_terrain(db_session):
    version, snapshot, effects, meta = await route_tasks._read_terrain()

    assert version == await WorkspaceRepository(db_session).get_version()
    assert set(snapshot) == {"layers", "features", "memberships"}
    assert all(len(row) == 3 for row in effects)
    assert {"requested_hash", "computed_hash"} <= set(meta)


@pytest.mark.asyncio
async def test_route_task_loads_terrain_from_the_database(db_session):
    terrain = await asyncio.to_thread(route_tasks._load_terrain)
    meta_hash = (await route_tasks._read_terrain())[3]["computed_hash"]
    version = await WorkspaceRepository(db_session).get_version()

    assert terrain.terrain_key == f"{version}:{meta_hash}"
    assert isinstance(terrain.stale, bool)
    assert terrain.cells
    assert terrain.constraints.epsg
