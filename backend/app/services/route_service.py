import uuid
from datetime import datetime, timezone

from app.schemas.geo import GeoLineString
from app.schemas.route import (
    PlannedRoute,
    RouteJobResponse,
    RouteListResponse,
    RouteRequest,
)
from app.workers.celery_app import celery_app
from app.workers.tasks.route_tasks import run_route_planning_job

_CELERY_STATUS_MAP = {
    "PENDING": "queued",
    "RECEIVED": "queued",
    "STARTED": "processing",
    "RETRY": "processing",
    "SUCCESS": "completed",
    "FAILURE": "failed",
}


async def generate_route_job(request: RouteRequest, user) -> RouteJobResponse:
    """Enqueue the background job and return its 202 payload.

    There is no persisted RouteJob record - the Celery task_id (== job_id ==
    request_id here, since nothing else exists to distinguish them) doubles
    as the job's identity, and its status/result live in the Celery result
    backend (Redis), read back out in get_routes().
    """
    job_id = str(uuid.uuid4())

    run_route_planning_job.apply_async(
        kwargs={
            "park_id": request.park_id,
            "start": request.start_point.coordinates,
            "end": request.end_point.coordinates,
            "max_time_min": request.max_time,
            "max_fuel_l": request.max_fuel,
            "num_alternatives": request.num_alternatives,
        },
        task_id=job_id,
    )

    return RouteJobResponse(
        job_id=job_id,
        request_id=job_id,
        park_id=request.park_id,
        status="queued",
        queued_at=datetime.now(timezone.utc).isoformat(),
    )


def _deserialize_route(data: dict) -> PlannedRoute:
    return PlannedRoute(
        suggested_path=data["suggested_path"],
        path_geometry=GeoLineString(**data["path_geometry"]),
        estimated_time_min=data["estimated_time_min"],
        estimated_fuel_l=data["estimated_fuel_l"],
        risk_coverage=data["risk_coverage"],
    )


async def get_routes(user, request_id=None, park_id=None, page=1, page_size=20):
    """Return job status and (paginated) results for a route request.

    When request_id is provided, loads the job's status and
    requested/found counts from the Celery result backend and returns its
    (paginated) results.

    Without request_id there is nothing to list: with no persisted RouteJob
    table, this service has no record of past jobs beyond their individual
    task ids, so browsing/filtering by park_id alone always returns empty.
    """
    if request_id is None:
        return RouteListResponse(
            total=0, page=page, page_size=page_size, results=[],
        )

    result = celery_app.AsyncResult(request_id)
    status = _CELERY_STATUS_MAP.get(result.state, result.state.lower())

    routes: list[PlannedRoute] = []
    num_requested = None
    num_found = None

    if result.state == "SUCCESS":
        payload = result.result
        routes = [_deserialize_route(r) for r in payload["results"]]
        num_requested = payload["num_alternatives_requested"]
        num_found = payload["num_alternatives_found"]

    start = (page - 1) * page_size
    page_results = routes[start : start + page_size]

    return RouteListResponse(
        request_id=request_id,
        status=status,
        num_alternatives_requested=num_requested,
        num_alternatives_found=num_found,
        total=len(routes),
        page=page,
        page_size=page_size,
        results=page_results,
    )
