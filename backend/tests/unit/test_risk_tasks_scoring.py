from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from app.workers.tasks.risk_tasks import _score


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_skips_when_no_active_model(mock_session_local, mock_repo):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session
    mock_repo.get_active_model = AsyncMock(return_value=None)

    result = await _score("klaserie")

    assert result == {"status": "skipped", "reason": "no_active_model"}


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_computes_and_saves_snapshot_when_model_exists(
    mock_session_local,
    mock_repo,
    mock_storage_cls,
    mock_load_model,
    mock_compute_features,
    mock_score_cells,
    mock_explain_cells,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/abc.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)
    mock_repo.persist_grid_cells = AsyncMock()
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage = MagicMock()
    mock_storage.download_model.return_value = b"model-bytes"
    mock_storage_cls.return_value = mock_storage
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    result = await _score("klaserie")

    assert result["status"] == "completed"
    assert result["heatmap_id"] == "heatmap-1"
    assert result["n_cells_scored"] == 1
    assert result["computed_at"] == "2026-06-01T00:00:00+00:00"
    mock_storage.download_model.assert_called_once_with(
        "risk-models/klaserie/abc.json",
    )
    mock_repo.save_heatmap_snapshot.assert_called_once()
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_result_computed_at_matches_repository_value_not_reference_time(  # noqa: E501
    mock_session_local,
    mock_repo,
    mock_storage_cls,
    mock_load_model,
    mock_compute_features,
    mock_score_cells,
    mock_explain_cells,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/abc.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)
    mock_repo.persist_grid_cells = AsyncMock()
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    db_computed_at = datetime(2026, 6, 1, 12, 30, tzinfo=timezone.utc)
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", db_computed_at),
    )

    mock_storage = MagicMock()
    mock_storage.download_model.return_value = b"model-bytes"
    mock_storage_cls.return_value = mock_storage
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    result = await _score("klaserie")

    assert result["computed_at"] == db_computed_at.isoformat()


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_skips_when_model_artifact_missing_from_storage(
    mock_session_local,
    mock_repo,
    mock_storage_cls,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/gone.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)

    mock_storage = MagicMock()
    mock_storage.download_model.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}},
        "GetObject",
    )
    mock_storage_cls.return_value = mock_storage

    result = await _score("klaserie")

    assert result == {"status": "skipped", "reason": "model_artifact_missing"}


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_reraises_non_missing_key_client_errors(
    mock_session_local,
    mock_repo,
    mock_storage_cls,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/broken.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)

    mock_storage = MagicMock()
    mock_storage.download_model.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "nope"}},
        "GetObject",
    )
    mock_storage_cls.return_value = mock_storage

    with pytest.raises(ClientError):
        await _score("klaserie")


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_labels_manual_trigger_as_ad_hoc(
    mock_session_local,
    mock_repo,
    mock_storage_cls,
    mock_load_model,
    mock_compute_features,
    mock_score_cells,
    mock_explain_cells,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/abc.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)
    mock_repo.persist_grid_cells = AsyncMock()
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage = MagicMock()
    mock_storage.download_model.return_value = b"model-bytes"
    mock_storage_cls.return_value = mock_storage
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    await _score("klaserie", triggered_manually=True)

    call_kwargs = mock_repo.save_heatmap_snapshot.call_args.kwargs
    assert call_kwargs["time_interval"] == "ad-hoc"


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks.RiskModelStorage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_labels_scheduled_trigger_as_6h_by_default(
    mock_session_local,
    mock_repo,
    mock_storage_cls,
    mock_load_model,
    mock_compute_features,
    mock_score_cells,
    mock_explain_cells,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/abc.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)
    mock_repo.persist_grid_cells = AsyncMock()
    mock_repo.get_grid_cells = AsyncMock(
        return_value=[{"cell_id": "c1", "row": 0, "col": 0}],
    )
    mock_repo.fetch_incidents_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage = MagicMock()
    mock_storage.download_model.return_value = b"model-bytes"
    mock_storage_cls.return_value = mock_storage
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    await _score("klaserie")

    call_kwargs = mock_repo.save_heatmap_snapshot.call_args.kwargs
    assert call_kwargs["time_interval"] == "6h"
