from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.demo_service import DemoService


def _service(calls: list[str]):
    repository = MagicMock()
    repository.reset_database = AsyncMock(
        side_effect=lambda username: calls.append(f"db:{username}"),
    )
    media_service = MagicMock()
    media_service.empty_bucket.side_effect = lambda: calls.append("bucket")
    return DemoService(repository, media_service), repository, media_service


@pytest.mark.asyncio
async def test_reset_resets_database_then_deletes_grid_then_bucket():
    calls: list[str] = []
    service, _, _ = _service(calls)

    with patch("app.services.demo_service.GRID_FILE_PATH") as grid_path:
        grid_path.unlink.side_effect = lambda **_: calls.append("grid")
        await service.reset()

    assert calls == ["db:admin1", "grid", "bucket"]
    grid_path.unlink.assert_called_once_with(missing_ok=True)


@pytest.mark.asyncio
async def test_reset_deletes_the_grid_file(tmp_path):
    grid_file = tmp_path / "reserve-grid.geojson"
    grid_file.write_text("{}")
    service, _, _ = _service([])

    with patch("app.services.demo_service.GRID_FILE_PATH", grid_file):
        await service.reset()

    assert not grid_file.exists()


@pytest.mark.asyncio
async def test_reset_succeeds_when_no_grid_was_uploaded(tmp_path):
    service, _, media_service = _service([])

    with patch(
        "app.services.demo_service.GRID_FILE_PATH",
        tmp_path / "missing.geojson",
    ):
        await service.reset()

    media_service.empty_bucket.assert_called_once()


@pytest.mark.asyncio
async def test_reset_succeeds_when_emptying_the_bucket_fails(tmp_path):
    service, _, media_service = _service([])
    media_service.empty_bucket.side_effect = RuntimeError("storage down")

    with patch(
        "app.services.demo_service.GRID_FILE_PATH",
        tmp_path / "missing.geojson",
    ):
        await service.reset()

    media_service.empty_bucket.assert_called_once()


@pytest.mark.asyncio
async def test_reset_stops_before_files_when_database_reset_fails():
    calls: list[str] = []
    service, repository, media_service = _service(calls)
    repository.reset_database.side_effect = RuntimeError("db down")

    with patch("app.services.demo_service.GRID_FILE_PATH") as grid_path:
        with pytest.raises(RuntimeError):
            await service.reset()

    grid_path.unlink.assert_not_called()
    media_service.empty_bucket.assert_not_called()


@pytest.mark.asyncio
async def test_klaserie_insert_recomputes_terrain_from_the_new_snapshot():
    repository = MagicMock()
    snapshot = {"layers": [], "features": [], "memberships": []}
    repository.replace_workspace_with_klaserie = AsyncMock(
        return_value=snapshot,
    )
    terrain = MagicMock()
    terrain.on_workspace_saved = AsyncMock()
    service = DemoService(repository, MagicMock(), terrain)

    await service.insert_klaserie_workspace("admin-id")

    repository.replace_workspace_with_klaserie.assert_awaited_once_with(
        "admin-id",
    )
    terrain.on_workspace_saved.assert_awaited_once_with(snapshot)


@pytest.mark.asyncio
async def test_klaserie_insert_survives_a_failed_terrain_recompute():
    repository = MagicMock()
    repository.replace_workspace_with_klaserie = AsyncMock(return_value={})
    terrain = MagicMock()
    terrain.on_workspace_saved = AsyncMock(side_effect=RuntimeError("down"))
    service = DemoService(repository, MagicMock(), terrain)

    await service.insert_klaserie_workspace("admin-id")

    terrain.on_workspace_saved.assert_awaited_once()
