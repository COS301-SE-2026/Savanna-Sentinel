from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from app.workers.ml.risk_engine import (
    _INCIDENT_FLOOR_BASE,
    _SIGHTING_LOOKBACK_DAYS,
)
from app.workers.tasks.risk_tasks import _FEATURE_LOOKBACK_DAYS, _score


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
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_computes_and_saves_snapshot_when_model_exists(
    mock_session_local,
    mock_repo,
    mock_storage,
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
    mock_repo.fetch_sightings_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage.download_model.return_value = b"model-bytes"
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    result = await _score("klaserie")

    assert result["status"] == "completed"
    assert result["heatmap_id"] == "heatmap-1"
    assert result["n_cells_scored"] == 1

    incidents_since = mock_repo.fetch_incidents_by_cell.call_args.args[2]
    sightings_since = mock_repo.fetch_sightings_by_cell.call_args.args[2]
    assert sightings_since > incidents_since
    assert (sightings_since - incidents_since).days == (
        _FEATURE_LOOKBACK_DAYS - _SIGHTING_LOOKBACK_DAYS
    )
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
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_result_computed_at_matches_repository_value_not_reference_time(  # noqa: E501
    mock_session_local,
    mock_repo,
    mock_storage,
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
    mock_repo.fetch_sightings_by_cell = AsyncMock(return_value={})
    db_computed_at = datetime(2026, 6, 1, 12, 30, tzinfo=timezone.utc)
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", db_computed_at),
    )

    mock_storage.download_model.return_value = b"model-bytes"
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    result = await _score("klaserie")

    assert result["computed_at"] == db_computed_at.isoformat()


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_skips_when_model_artifact_missing_from_storage(
    mock_session_local,
    mock_repo,
    mock_storage,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/gone.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)

    mock_storage.download_model.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}},
        "GetObject",
    )

    result = await _score("klaserie")

    assert result == {"status": "skipped", "reason": "model_artifact_missing"}


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_reraises_non_missing_key_client_errors(
    mock_session_local,
    mock_repo,
    mock_storage,
):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    active_model = MagicMock(
        id="model-1",
        object_storage_key="risk-models/klaserie/broken.json",
    )
    mock_repo.get_active_model = AsyncMock(return_value=active_model)

    mock_storage.download_model.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "nope"}},
        "GetObject",
    )

    with pytest.raises(ClientError):
        await _score("klaserie")


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_labels_manual_trigger_as_ad_hoc(
    mock_session_local,
    mock_repo,
    mock_storage,
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
    mock_repo.fetch_sightings_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage.download_model.return_value = b"model-bytes"
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
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_labels_scheduled_trigger_as_6h_by_default(
    mock_session_local,
    mock_repo,
    mock_storage,
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
    mock_repo.fetch_sightings_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage.download_model.return_value = b"model-bytes"
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.4}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    await _score("klaserie")

    call_kwargs = mock_repo.save_heatmap_snapshot.call_args.kwargs
    assert call_kwargs["time_interval"] == "6h"


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_raises_a_low_model_cell_with_a_recent_incident(
    mock_session_local,
    mock_repo,
    mock_storage,
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
    mock_repo.fetch_incidents_by_cell = AsyncMock(
        return_value={
            "c1": [
                {
                    "occurred_at": datetime.now(timezone.utc),
                    "severity": "high",
                    "source_tier": "field_report",
                },
            ],
        },
    )
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_sightings_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage.download_model.return_value = b"model-bytes"
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.1}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    await _score("klaserie")

    saved_scores = mock_repo.save_heatmap_snapshot.call_args.args[3]
    saved_explanations = mock_repo.save_heatmap_snapshot.call_args.args[5]
    assert saved_scores["c1"] == pytest.approx(
        _INCIDENT_FLOOR_BASE["high"],
        rel=1e-6,
    )
    assert saved_explanations["c1"] == [("recent_incident", 1.0)]


@pytest.mark.asyncio
@patch("app.workers.tasks.risk_tasks.explain_cells")
@patch("app.workers.tasks.risk_tasks.score_cells")
@patch("app.workers.tasks.risk_tasks.compute_cell_features")
@patch("app.workers.tasks.risk_tasks.load_model")
@patch("app.workers.tasks.risk_tasks._storage")
@patch("app.workers.tasks.risk_tasks.risk_repository")
@patch("app.workers.tasks.risk_tasks._TaskSessionLocal")
async def test_score_leaves_a_cell_untouched_when_its_incident_is_stale(
    mock_session_local,
    mock_repo,
    mock_storage,
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
    mock_repo.fetch_incidents_by_cell = AsyncMock(
        return_value={
            "c1": [
                {
                    "occurred_at": datetime.now(timezone.utc)
                    - timedelta(days=200),
                    "severity": "high",
                    "source_tier": "field_report",
                },
            ],
        },
    )
    mock_repo.fetch_patrol_tracks_by_cell = AsyncMock(return_value={})
    mock_repo.fetch_sightings_by_cell = AsyncMock(return_value={})
    mock_repo.save_heatmap_snapshot = AsyncMock(
        return_value=("heatmap-1", datetime(2026, 6, 1, tzinfo=timezone.utc)),
    )

    mock_storage.download_model.return_value = b"model-bytes"
    mock_load_model.return_value = "the-model"
    mock_compute_features.return_value = {"c1": {"incident_density_self": 1.0}}
    mock_score_cells.return_value = {"c1": 0.1}
    mock_explain_cells.return_value = {"c1": [("incident_density_self", 1.0)]}

    await _score("klaserie")

    saved_scores = mock_repo.save_heatmap_snapshot.call_args.args[3]
    saved_explanations = mock_repo.save_heatmap_snapshot.call_args.args[5]
    assert saved_scores["c1"] == 0.1
    assert saved_explanations["c1"] == [("incident_density_self", 1.0)]
