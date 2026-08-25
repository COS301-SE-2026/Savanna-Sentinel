from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.workers.tasks.risk_tasks import _train


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_train_skips_when_not_enough_examples(
    mock_session_local,
    mock_repo,
    mock_storage,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.persist_grid_cells = AsyncMock()

    result = await _train(
        park_id="klaserie",
        window_start=datetime(2026, 1, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 1, 3, tzinfo=timezone.utc),
        triggered_by="user-1",
    )

    assert result["status"] == "skipped"
    assert result["reason"] == "insufficient_training_examples"
    mock_storage.upload_model.assert_not_called()


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.build_training_examples")
@patch("app.workers.tasks.risk_tasks.train_model")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_train_uploads_model_and_saves_version_on_success(
    mock_session_local,
    mock_repo,
    mock_train_model,
    mock_build_examples,
    mock_storage,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.persist_grid_cells = AsyncMock()
    mock_repo.save_model_version = AsyncMock(return_value="model-123")

    mock_build_examples.return_value = [
        {
            "cell_id": "c1",
            "reference_time": datetime.now(timezone.utc),
            "features": {},
            "label": i % 2,
        }
        for i in range(30)
    ]
    mock_train_model.return_value = (
        b"model-bytes",
        {"precision": 0.7, "recall": 0.6, "auc": 0.8},
    )

    mock_storage.upload_model.return_value = "risk-models/klaserie/abc.json"

    result = await _train(
        park_id="klaserie",
        window_start=datetime(2026, 1, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 3, 1, tzinfo=timezone.utc),
        triggered_by="user-1",
    )

    assert result["status"] == "completed"
    assert result["model_id"] == "model-123"
    assert result["metrics"] == {"precision": 0.7, "recall": 0.6, "auc": 0.8}
    mock_storage.upload_model.assert_called_once_with(
        "klaserie",
        b"model-bytes",
    )
    mock_repo.save_model_version.assert_called_once()
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.build_training_examples")
@patch("app.workers.tasks.risk_tasks.train_model")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_train_reports_conflict_on_concurrent_active_model_insert(
    mock_session_local,
    mock_repo,
    mock_train_model,
    mock_build_examples,
    mock_storage,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.persist_grid_cells = AsyncMock()
    mock_repo.save_model_version = AsyncMock(
        side_effect=IntegrityError("insert", {}, Exception("conflict")),
    )

    mock_build_examples.return_value = [
        {
            "cell_id": "c1",
            "reference_time": datetime.now(timezone.utc),
            "features": {},
            "label": i % 2,
        }
        for i in range(30)
    ]
    mock_train_model.return_value = (
        b"model-bytes",
        {"precision": 0.7, "recall": 0.6, "auc": 0.8},
    )

    mock_storage.upload_model.return_value = "risk-models/klaserie/abc.json"

    result = await _train(
        park_id="klaserie",
        window_start=datetime(2026, 1, 1, tzinfo=timezone.utc),
        window_end=datetime(2026, 3, 1, tzinfo=timezone.utc),
        triggered_by="user-1",
    )

    assert result == {
        "status": "failed",
        "reason": "concurrent_training_conflict",
    }
    mock_session.rollback.assert_called_once()
    mock_session.commit.assert_not_called()
