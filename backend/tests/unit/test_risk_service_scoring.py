from unittest.mock import MagicMock, patch

from app.services.risk_service import get_scoring_job, trigger_scoring_job


class _FakeUser:
    id = "user-1"


@patch("app.services.risk_service.run_risk_scoring_job")
def test_trigger_scoring_job_enqueues_for_klaserie(mock_task):
    result = trigger_scoring_job(_FakeUser())

    mock_task.apply_async.assert_called_once()
    call_kwargs = mock_task.apply_async.call_args.kwargs["kwargs"]
    assert call_kwargs["park_id"] == "klaserie"
    assert call_kwargs["triggered_manually"] is True
    assert result.status == "queued"


@patch("app.services.risk_service.celery_app")
def test_get_scoring_job_maps_success_state(mock_celery_app):
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "status": "completed",
            "heatmap_id": "h-1",
            "computed_at": "2026-06-01T00:00:00+00:00",
            "n_cells_scored": 5,
        },
    )

    result = get_scoring_job("job-1")

    assert result.status == "completed"
    assert result.heatmap_id == "h-1"
    assert result.n_cells_scored == 5


@patch("app.services.risk_service.celery_app")
def test_get_scoring_job_maps_skipped_result_as_its_own_status(mock_celery_app):
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={"status": "skipped", "reason": "no_active_model"},
    )

    result = get_scoring_job("job-1")

    assert result.status == "skipped"
    assert result.heatmap_id is None
