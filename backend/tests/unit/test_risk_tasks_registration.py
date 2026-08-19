import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.workers.tasks.risk_tasks import _score, _train

_BACKEND_DIR = Path(__file__).resolve().parents[2]


def test_risk_tasks_are_registered_on_the_celery_app():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import app.workers.tasks\n"
            "from app.workers.celery_app import celery_app\n"
            "assert 'risk.train_model' in celery_app.tasks\n"
            "assert 'risk.score_heatmap' in celery_app.tasks\n",
        ],
        cwd=_BACKEND_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_train_can_run_twice_in_the_same_process(
    mock_session_local,
    mock_repo,
    mock_storage_cls,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.persist_grid_cells = AsyncMock()

    kwargs = dict(
        park_id="klaserie",
        window_start=datetime(2026, 1, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 1, 3, tzinfo=timezone.utc),
        triggered_by="user-1",
    )

    first = await _train(**kwargs)
    second = await _train(**kwargs)

    assert first["status"] == "skipped"
    assert second["status"] == "skipped"


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_can_run_twice_in_the_same_process(
    mock_session_local,
    mock_repo,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session
    mock_repo.get_active_model = AsyncMock(return_value=None)

    first = await _score("klaserie")
    second = await _score("klaserie")

    assert first == {"status": "skipped", "reason": "no_active_model"}
    assert second == {"status": "skipped", "reason": "no_active_model"}
