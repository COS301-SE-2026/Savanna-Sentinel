from unittest.mock import MagicMock, patch

import pytest

from app.schemas.geo import GeoLineString, GeoPoint
from app.schemas.route import PlannedRoute, RouteRequest
from app.services.route_service import generate_route_job, get_routes
from app.workers.tasks.route_tasks import _serialize_route

pytestmark = pytest.mark.asyncio


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


def _make_request(num_alternatives=3):
    return RouteRequest(
        park_id="klaserie",
        start_point=GeoPoint(coordinates=(31.05, -24.3)),
        end_point=GeoPoint(coordinates=(31.1, -24.2)),
        max_time=120.0,
        max_fuel=10.0,
        num_alternatives=num_alternatives,
    )


# generate_route_job


@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_enqueues_with_request_fields(mock_task):
    request = _make_request(num_alternatives=2)

    result = await generate_route_job(request, user=MagicMock())

    mock_task.apply_async.assert_called_once()
    call = mock_task.apply_async.call_args
    assert call.kwargs["kwargs"] == {
        "park_id": "klaserie",
        "start": (31.05, -24.3),
        "end": (31.1, -24.2),
        "max_time_min": 120.0,
        "max_fuel_l": 10.0,
        "num_alternatives": 2,
    }
    assert call.kwargs["task_id"] == result.job_id


@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_returns_queued_response(mock_task):
    request = _make_request()

    result = await generate_route_job(request, user=MagicMock())

    assert result.job_id == result.request_id
    assert result.park_id == "klaserie"
    assert result.status == "queued"
    assert result.queued_at != ""


@patch("app.services.route_service.run_route_planning_job")
async def test_generate_route_job_ids_are_unique_per_call(mock_task):
    request = _make_request()

    first = await generate_route_job(request, user=MagicMock())
    second = await generate_route_job(request, user=MagicMock())

    assert first.job_id != second.job_id


# get_routes - no request_id


async def test_get_routes_without_request_id_returns_empty_listing():
    result = await get_routes(user=MagicMock(), request_id=None)

    assert result.total == 0
    assert result.results == []
    assert result.request_id is None
    assert result.status is None


async def test_get_routes_without_request_id_still_paginates_response():
    result = await get_routes(
        user=MagicMock(), request_id=None, page=3, page_size=5,
    )

    assert result.page == 3
    assert result.page_size == 5


# get_routes - status mapping


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
async def test_get_routes_maps_celery_state_to_status(
    mock_celery_app, celery_state, expected_status,
):
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state=celery_state, result=None,
    )

    result = await get_routes(user=MagicMock(), request_id="job-123")

    mock_celery_app.AsyncResult.assert_called_once_with("job-123")
    assert result.status == expected_status
    assert result.results == []
    assert result.num_alternatives_requested is None
    assert result.num_alternatives_found is None


# get_routes - success state


@patch("app.services.route_service.celery_app")
async def test_get_routes_success_deserializes_results_and_counts(
    mock_celery_app,
):
    routes = [_make_route(["a", "b"], 0.9), _make_route(["a", "c"], 0.5)]
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "park_id": "klaserie",
            "num_alternatives_requested": 3,
            "num_alternatives_found": 2,
            "results": [_serialize_route(r) for r in routes],
        },
    )

    result = await get_routes(user=MagicMock(), request_id="job-123")

    assert result.status == "completed"
    assert result.num_alternatives_requested == 3
    assert result.num_alternatives_found == 2
    assert result.total == 2
    assert [r.suggested_path for r in result.results] == [
        ["a", "b"], ["a", "c"],
    ]
    assert [r.risk_coverage for r in result.results] == [0.9, 0.5]


@patch("app.services.route_service.celery_app")
async def test_get_routes_success_paginates_results(mock_celery_app):
    routes = [_make_route([str(i)], float(i)) for i in range(5)]
    mock_celery_app.AsyncResult.return_value = MagicMock(
        state="SUCCESS",
        result={
            "park_id": "klaserie",
            "num_alternatives_requested": 5,
            "num_alternatives_found": 5,
            "results": [_serialize_route(r) for r in routes],
        },
    )

    result = await get_routes(
        user=MagicMock(), request_id="job-123", page=2, page_size=2,
    )

    assert result.total == 5
    assert result.page == 2
    assert result.page_size == 2
    assert [r.risk_coverage for r in result.results] == [2.0, 3.0]
