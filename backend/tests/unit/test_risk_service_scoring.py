from unittest.mock import MagicMock, patch

import pytest

from app.repositories.risk_repository import create_risk_job, risk_job_exists
from app.services.risk_service import get_scoring_job, trigger_scoring_job


class _FakeUser:
    id = "user-1"


@pytest.mark.asyncio
@patch("app.services.risk_service.run_risk_scoring_job")
async def test_trigger_scoring_job_enqueues_for_klaserie(mock_task, db_session):
    result = await trigger_scoring_job(db_session, _FakeUser())

    mock_task.apply_async.assert_called_once()
    call_kwargs = mock_task.apply_async.call_args.kwargs["kwargs"]
    assert call_kwargs["park_id"] == "klaserie"
    assert call_kwargs["triggered_manually"] is True
    assert result.status == "queued"


@pytest.mark.asyncio
@patch("app.services.risk_service.run_risk_scoring_job")
async def test_trigger_scoring_job_persists_a_row(mock_task, db_session):
    result = await trigger_scoring_job(db_session, _FakeUser())

    assert await risk_job_exists(db_session, result.job_id, "score") is True


@pytest.mark.asyncio
async def test_get_scoring_job_raises_404_for_unknown_job(db_session):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await get_scoring_job(db_session, "nonexistent-job-id")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
@patch("app.services.risk_service.celery_app")
async def test_get_scoring_job_maps_success_state(mock_celery_app, db_session):
    await create_risk_job(
        db_session,
        job_id="a1111111-1111-1111-1111-111111111111",
        job_type="score",
        park_id="klaserie",
        triggered_by="user-1",
    )
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "status": "completed",
            "heatmap_id": "h-1",
            "computed_at": "2026-06-01T00:00:00+00:00",
            "n_cells_scored": 5,
        },
    )

    result = await get_scoring_job(
        db_session,
        "a1111111-1111-1111-1111-111111111111",
    )

    assert result.status == "completed"
    assert result.heatmap_id == "h-1"
    assert result.n_cells_scored == 5


@pytest.mark.asyncio
@patch("app.services.risk_service.celery_app")
async def test_get_scoring_job_maps_skipped_result_as_its_own_status(
    mock_celery_app,
    db_session,
):
    await create_risk_job(
        db_session,
        job_id="a1111111-1111-1111-1111-111111111111",
        job_type="score",
        park_id="klaserie",
        triggered_by="user-1",
    )
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={"status": "skipped", "reason": "no_active_model"},
    )

    result = await get_scoring_job(
        db_session,
        "a1111111-1111-1111-1111-111111111111",
    )

    assert result.status == "skipped"
    assert result.heatmap_id is None
