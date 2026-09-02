from unittest.mock import MagicMock, patch

import pytest

from app.repositories.route_job_repository import route_job_exists_for_user
from app.schemas.geo import GeoLineString, GeoPoint
from app.schemas.route import PlannedRoute, RouteRequest
from app.services.route_service import generate_route_job, get_routes
from app.workers.tasks.route_tasks import _serialize_route


class _FakeUser:
    id = "user-1"


class _OtherUser:
    id = "user-2"


def _make_route(path, risk):
    return PlannedRoute(
        suggested_path=path,
        path_geometry=GeoLineString(
            coordinates=[(0.0, 0.0), (1.0, 1.0)],
        ),
        estimated_time_min=6.0,
        estimated_fuel_l=0.3,
        risk_coverage=risk,
    )


def _make_request(num_alternatives=3, risk_by_cell=None):
    return RouteRequest(
        start_point=GeoPoint(coordinates=(31.05, -24.3)),
        end_point=GeoPoint(coordinates=(31.1, -24.2)),
        max_time=120.0,
        max_fuel=10.0,
        num_alternatives=num_alternatives,
        risk_by_cell=risk_by_cell or {},
    )


# generate_route_job


@pytest.mark.asyncio
@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_enqueues_with_request_fields(
    mock_task,
    db_session,
):
    request = _make_request(num_alternatives=2)

    result = await generate_route_job(db_session, _FakeUser(), request)

    mock_task.apply_async.assert_called_once()
    call = mock_task.apply_async.call_args
    assert call.kwargs["kwargs"] == {
        "park_id": "klaserie",
        "start": (31.05, -24.3),
        "end": (31.1, -24.2),
        "max_time_min": 120.0,
        "max_fuel_l": 10.0,
        "num_alternatives": 2,
        "risk_by_cell": {},
    }
    assert call.kwargs["task_id"] == result.job_id


@pytest.mark.asyncio
@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_forwards_risk_by_cell(mock_task, db_session):
    request = _make_request(risk_by_cell={"cell-1": 0.6, "cell-2": 0.2})

    await generate_route_job(db_session, _FakeUser(), request)

    call = mock_task.apply_async.call_args
    assert call.kwargs["kwargs"]["risk_by_cell"] == {
        "cell-1": 0.6,
        "cell-2": 0.2,
    }


@pytest.mark.asyncio
@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_returns_queued_response(
    mock_task,
    db_session,
):
    request = _make_request()

    result = await generate_route_job(db_session, _FakeUser(), request)

    assert result.job_id == result.request_id
    assert result.park_id == "klaserie"
    assert result.status == "queued"
    assert result.queued_at != ""


@pytest.mark.asyncio
@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_ids_are_unique_per_call(
    mock_task,
    db_session,
):
    request = _make_request()

    first = await generate_route_job(db_session, _FakeUser(), request)
    second = await generate_route_job(db_session, _FakeUser(), request)

    assert first.job_id != second.job_id


@pytest.mark.asyncio
@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_persists_a_row_owned_by_the_user(
    mock_task,
    db_session,
):
    request = _make_request()

    result = await generate_route_job(db_session, _FakeUser(), request)

    assert (
        await route_job_exists_for_user(db_session, result.job_id, "user-1")
        is True
    )


# get_routes - no request_id


@pytest.mark.asyncio
async def test_get_routes_without_request_id_returns_empty_listing(db_session):
    result = await get_routes(db_session, _FakeUser(), request_id=None)

    assert result.total == 0
    assert result.results == []
    assert result.request_id is None
    assert result.status is None


@pytest.mark.asyncio
async def test_get_routes_without_request_id_still_paginates_response(
    db_session,
):
    result = await get_routes(
        db_session,
        _FakeUser(),
        request_id=None,
        page=3,
        page_size=5,
    )

    assert result.page == 3
    assert result.page_size == 5


# get_routes - unknown / foreign job id


@pytest.mark.asyncio
async def test_get_routes_raises_404_for_unknown_job_id(db_session):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await get_routes(db_session, _FakeUser(), request_id="nonexistent")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
@patch("app.services.route_service.run_route_planning_job")
async def test_get_routes_raises_404_for_another_users_job(
    mock_task,
    db_session,
):
    from fastapi import HTTPException

    generated = await generate_route_job(
        db_session,
        _FakeUser(),
        _make_request(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_routes(
            db_session,
            _OtherUser(),
            request_id=generated.job_id,
        )

    assert exc_info.value.status_code == 404


# get_routes - status mapping


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("celery_state", "expected_status"),
    [
        ("PENDING", "queued"),
        ("RECEIVED", "queued"),
        ("STARTED", "processing"),
        ("RETRY", "processing"),
        ("FAILURE", "failed"),
        ("REVOKED", "revoked"),
    ],
)
@patch("app.services.route_service.celery_app")
@patch("app.services.route_service.run_route_planning_job")
async def test_get_routes_maps_celery_state_to_status(
    mock_run_task,
    mock_celery_app,
    celery_state,
    expected_status,
    db_session,
):
    generated = await generate_route_job(
        db_session,
        _FakeUser(),
        _make_request(),
    )
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state=celery_state,
        result=None,
    )

    result = await get_routes(
        db_session,
        _FakeUser(),
        request_id=generated.job_id,
    )

    mock_celery_app.AsyncResult.assert_called_once_with(generated.job_id)
    assert result.status == expected_status
    assert result.results == []


# get_routes - success state


@pytest.mark.asyncio
@patch("app.services.route_service.celery_app")
@patch("app.services.route_service.run_route_planning_job")
async def test_get_routes_success_deserializes_results_and_counts(
    mock_run_task,
    mock_celery_app,
    db_session,
):
    generated = await generate_route_job(
        db_session,
        _FakeUser(),
        _make_request(),
    )
    routes = [_make_route(["a", "b"], 0.4), _make_route(["a", "c"], 0.6)]
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "results": [_serialize_route(r) for r in routes],
            "num_alternatives_requested": 3,
            "num_alternatives_found": 2,
        },
    )

    result = await get_routes(
        db_session,
        _FakeUser(),
        request_id=generated.job_id,
    )

    assert result.num_alternatives_requested == 3
    assert result.num_alternatives_found == 2
    assert result.total == 2
    assert len(result.results) == 2


@pytest.mark.asyncio
@patch("app.services.route_service.celery_app")
@patch("app.services.route_service.run_route_planning_job")
async def test_get_routes_success_paginates_results(
    mock_run_task,
    mock_celery_app,
    db_session,
):
    generated = await generate_route_job(
        db_session,
        _FakeUser(),
        _make_request(),
    )
    routes = [_make_route([str(i)], 0.1 * i) for i in range(5)]
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "results": [_serialize_route(r) for r in routes],
            "num_alternatives_requested": 5,
            "num_alternatives_found": 5,
        },
    )

    result = await get_routes(
        db_session,
        _FakeUser(),
        request_id=generated.job_id,
        page=2,
        page_size=2,
    )

    assert len(result.results) == 2
    assert result.total == 5
    assert result.page == 2
    assert result.page_size == 2
