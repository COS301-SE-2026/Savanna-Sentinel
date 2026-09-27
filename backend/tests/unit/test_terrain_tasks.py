import subprocess
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pyproj import Transformer
from shapely.geometry import box

from app.workers.tasks.terrain_tasks import _compute
from app.workers.terrain.constants import AVOID_MAX

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_EPSG = 32736
_TO_LONLAT = Transformer.from_crs(f"EPSG:{_EPSG}", "EPSG:4326", always_xy=True)


def test_the_terrain_task_is_registered_on_the_celery_app():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import app.workers.tasks\n"
            "from app.workers.celery_app import celery_app\n"
            "assert 'terrain.compute_effects' in celery_app.tasks\n",
        ],
        cwd=_BACKEND_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def _snapshot():
    lon, lat = _TO_LONLAT.transform(300500.0, 7300500.0)
    return {
        "layers": [
            {
                "id": "l1",
                "parent_id": None,
                "order": 0,
                "default_rules": {"avoid": {"strength": 1.0}},
            },
        ],
        "features": [
            {
                "id": "f1",
                "type": "point",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "in_effect": True,
                "buffer_enabled": False,
                "buffer_distance_m": 100.0,
                "rules": {},
            },
        ],
        "memberships": [
            {"id": "m1", "feature_id": "f1", "layer_id": "l1", "order": 0},
        ],
    }


def _patch_repos(workspace_repo, terrain_repo):
    return (
        patch(
            "app.workers.tasks.terrain_tasks.WorkspaceRepository",
            return_value=workspace_repo,
        ),
        patch(
            "app.workers.tasks.terrain_tasks.TerrainRepository",
            return_value=terrain_repo,
        ),
    )


@pytest.mark.asyncio
@patch("app.workers.tasks.terrain_tasks.load_projected_cells")
@patch("app.workers.tasks.terrain_tasks._TaskSessionLocal")
async def test_compute_saves_the_effects_it_derives(
    mock_session_local,
    mock_load_cells,
):
    mock_session_local.return_value.__aenter__.return_value = AsyncMock()
    mock_load_cells.return_value = (
        [("cell-1", box(300000.0, 7300000.0, 301000.0, 7301000.0))],
        _EPSG,
    )
    workspace_repo = MagicMock()
    workspace_repo.get_version = AsyncMock(return_value=4)
    workspace_repo.load_snapshot = AsyncMock(return_value=_snapshot())
    terrain_repo = MagicMock()
    terrain_repo.replace_effects = AsyncMock(return_value=True)

    first, second = _patch_repos(workspace_repo, terrain_repo)
    with first, second:
        result = await _compute()

    assert result == {"status": "completed", "n_cells": 1}
    args = terrain_repo.replace_effects.call_args.args
    effects, computed_hash, version = args
    assert effects["cell-1"]["route_multiplier"] == pytest.approx(AVOID_MAX)
    assert isinstance(computed_hash, str)
    assert version == 4


@pytest.mark.asyncio
@patch("app.workers.tasks.terrain_tasks.load_projected_cells")
@patch("app.workers.tasks.terrain_tasks._TaskSessionLocal")
async def test_compute_is_superseded_when_a_newer_request_exists(
    mock_session_local,
    mock_load_cells,
):
    mock_session_local.return_value.__aenter__.return_value = AsyncMock()
    mock_load_cells.return_value = ([], _EPSG)
    workspace_repo = MagicMock()
    workspace_repo.get_version = AsyncMock(return_value=1)
    workspace_repo.load_snapshot = AsyncMock(return_value=_snapshot())
    terrain_repo = MagicMock()
    terrain_repo.replace_effects = AsyncMock(return_value=False)

    first, second = _patch_repos(workspace_repo, terrain_repo)
    with first, second:
        result = await _compute()

    assert result == {"status": "superseded"}


@pytest.mark.asyncio
@patch("app.workers.tasks.terrain_tasks.load_projected_cells")
@patch("app.workers.tasks.terrain_tasks._TaskSessionLocal")
async def test_compute_skips_when_there_is_no_park_grid(
    mock_session_local,
    mock_load_cells,
):
    mock_session_local.return_value.__aenter__.return_value = AsyncMock()
    mock_load_cells.side_effect = FileNotFoundError("no grid")
    workspace_repo = MagicMock()
    workspace_repo.get_version = AsyncMock(return_value=1)
    workspace_repo.load_snapshot = AsyncMock(return_value=_snapshot())
    terrain_repo = MagicMock()
    terrain_repo.replace_effects = AsyncMock()

    first, second = _patch_repos(workspace_repo, terrain_repo)
    with first, second:
        result = await _compute()

    assert result == {"status": "skipped", "reason": "no_grid"}
    terrain_repo.replace_effects.assert_not_called()


@pytest.mark.asyncio
@patch("app.workers.tasks.terrain_tasks.load_projected_cells")
@patch("app.workers.tasks.terrain_tasks._TaskSessionLocal")
async def test_compute_clears_effects_when_there_are_no_rules_and_no_grid(
    mock_session_local,
    mock_load_cells,
):
    mock_session_local.return_value.__aenter__.return_value = AsyncMock()
    mock_load_cells.side_effect = FileNotFoundError("no grid")
    workspace_repo = MagicMock()
    workspace_repo.get_version = AsyncMock(return_value=2)
    workspace_repo.load_snapshot = AsyncMock(
        return_value={"layers": [], "features": [], "memberships": []},
    )
    terrain_repo = MagicMock()
    terrain_repo.replace_effects = AsyncMock(return_value=True)

    first, second = _patch_repos(workspace_repo, terrain_repo)
    with first, second:
        result = await _compute()

    assert result == {"status": "completed", "n_cells": 0}
    effects, _, version = terrain_repo.replace_effects.call_args.args
    assert effects == {}
    assert version == 2
