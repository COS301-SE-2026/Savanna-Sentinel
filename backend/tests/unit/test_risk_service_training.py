from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.repositories.risk_repository import risk_job_exists
from app.schemas.risk import RiskTrainRequest
from app.services.risk_service import get_training_job, trigger_training_job


class _FakeUser:
    id = "user-1"


def _make_request():
    now = datetime.now(timezone.utc)
    return RiskTrainRequest(
        window_start=now - timedelta(days=90),
        window_end=now - timedelta(days=1),
    )


@pytest.mark.asyncio
@patch("app.services.risk_service.run_risk_training_job")
async def test_trigger_training_job_enqueues_and_returns_queued(
    mock_task,
    db_session,
):
    result = await trigger_training_job(
        db_session,
        _make_request(),
        _FakeUser(),
    )

    mock_task.apply_async.assert_called_once()
    call_kwargs = mock_task.apply_async.call_args.kwargs["kwargs"]
    assert call_kwargs["park_id"] == "klaserie"
    assert call_kwargs["triggered_by"] == "user-1"
    assert result.status == "queued"
    assert result.job_id != ""


@pytest.mark.asyncio
@patch("app.services.risk_service.run_risk_training_job")
async def test_trigger_training_job_persists_a_row(mock_task, db_session):
    result = await trigger_training_job(
        db_session,
        _make_request(),
        _FakeUser(),
    )

    assert await risk_job_exists(db_session, result.job_id, "train") is True


@pytest.mark.asyncio
async def test_get_training_job_raises_404_for_unknown_job(db_session):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await get_training_job(db_session, "nonexistent-job-id")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
@patch("app.services.risk_service.celery_app")
async def test_get_training_job_maps_success_state(mock_celery_app, db_session):
    from app.repositories.risk_repository import create_risk_job

    await create_risk_job(
        db_session,
        job_id="a1111111-1111-1111-1111-111111111111",
        job_type="train",
        park_id="klaserie",
        triggered_by="user-1",
    )
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "status": "completed",
            "model_id": "m-1",
            "metrics": {"precision": 0.7},
            "n_training_examples": 40,
        },
    )

    result = await get_training_job(
        db_session,
        "a1111111-1111-1111-1111-111111111111",
    )

    assert result.status == "completed"
    assert result.model_id == "m-1"
    assert result.metrics == {"precision": 0.7}
    assert result.n_training_examples == 40


@pytest.mark.asyncio
@patch("app.services.risk_service.celery_app")
async def test_get_training_job_maps_pending_state(mock_celery_app, db_session):
    from app.repositories.risk_repository import create_risk_job

    await create_risk_job(
        db_session,
        job_id="a1111111-1111-1111-1111-111111111111",
        job_type="train",
        park_id="klaserie",
        triggered_by="user-1",
    )
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="PENDING",
        result=None,
    )

    result = await get_training_job(
        db_session,
        "a1111111-1111-1111-1111-111111111111",
    )

    assert result.status == "queued"
    assert result.model_id is None


@pytest.mark.asyncio
@patch("app.services.risk_service.run_risk_training_job")
@patch("app.services.risk_service.risk_repository.get_earliest_event_time")
async def test_trigger_training_job_resolves_window_start_from_earliest_event(
    mock_earliest,
    mock_task,
    db_session,
):
    earliest = datetime(2025, 1, 1, tzinfo=timezone.utc)
    mock_earliest.return_value = earliest
    request = RiskTrainRequest(
        window_end=datetime.now(timezone.utc) - timedelta(days=1),
    )

    await trigger_training_job(db_session, request, _FakeUser())

    call_kwargs = mock_task.apply_async.call_args.kwargs["kwargs"]
    assert call_kwargs["window_start"] == earliest.isoformat()


@pytest.mark.asyncio
@patch("app.services.risk_service.run_risk_training_job")
@patch("app.services.risk_service.risk_repository.get_earliest_event_time")
async def test_trigger_training_job_falls_back_to_window_end_no_events(
    mock_earliest,
    mock_task,
    db_session,
):
    mock_earliest.return_value = None
    window_end = datetime.now(timezone.utc) - timedelta(days=1)
    request = RiskTrainRequest(window_end=window_end)

    await trigger_training_job(db_session, request, _FakeUser())

    call_kwargs = mock_task.apply_async.call_args.kwargs["kwargs"]
    assert call_kwargs["window_start"] == window_end.isoformat()
