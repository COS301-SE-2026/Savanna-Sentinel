from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.schemas.risk import RiskTrainRequest
from app.services.risk_service import get_training_job, trigger_training_job


class _FakeUser:
    id = "user-1"


@patch("app.services.risk_service.run_risk_training_job")
def test_trigger_training_job_enqueues_and_returns_queued(mock_task):
    now = datetime.now(timezone.utc)
    request = RiskTrainRequest(
        window_start=now - timedelta(days=90),
        window_end=now - timedelta(days=1),
    )

    result = trigger_training_job(request, _FakeUser())

    mock_task.apply_async.assert_called_once()
    call_kwargs = mock_task.apply_async.call_args.kwargs["kwargs"]
    assert call_kwargs["park_id"] == "klaserie"
    assert call_kwargs["triggered_by"] == "user-1"
    assert result.status == "queued"
    assert result.job_id != ""


@patch("app.services.risk_service.celery_app")
def test_get_training_job_maps_success_state(mock_celery_app):
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "status": "completed",
            "model_id": "m-1",
            "metrics": {"precision": 0.7},
            "n_training_examples": 40,
        },
    )

    result = get_training_job("job-1")

    assert result.status == "completed"
    assert result.model_id == "m-1"
    assert result.metrics == {"precision": 0.7}
    assert result.n_training_examples == 40


@patch("app.services.risk_service.celery_app")
def test_get_training_job_maps_pending_state(mock_celery_app):
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="PENDING",
        result=None,
    )

    result = get_training_job("job-1")

    assert result.status == "queued"
    assert result.model_id is None
