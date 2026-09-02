import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import HTTPException, status

from app.core.config import settings
from app.repositories import route_job_repository
from app.repositories.patrol_route_repository import PatrolRouteRepository
from app.schemas.geo import GeoLineString
from app.schemas.route import (
    PlannedRoute,
    RouteJobResponse,
    RouteListResponse,
    RouteRequest,
    SavedRouteListResponse,
    SavedRouteResponse,
)
from app.workers.celery_app import CELERY_STATUS_MAP, celery_app
from app.workers.tasks.route_tasks import run_route_planning_job

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.schemas.route import SaveRouteRequest


async def generate_route_job(
    db: "AsyncSession",
    current_user: "User",
    request: RouteRequest,
) -> RouteJobResponse:
    """Enqueue the route-planning job and persist its identity.

    Returns the 202 payload. job_id is both the Celery task_id
    and the route_jobs primary key (see
    route_job_repository.create_route_job). Identifies
    queued jobs vs "not existing" jobs.
    """
    job_id = str(uuid.uuid4())

    await route_job_repository.create_route_job(
        db,
        job_id=job_id,
        park_id=settings.PARK_ID,
        requested_by=current_user.id,
    )

    run_route_planning_job.apply_async(
        kwargs={
            "park_id": settings.PARK_ID,
            "start": request.start_point.coordinates,
            "end": request.end_point.coordinates,
            "max_time_min": request.max_time,
            "max_fuel_l": request.max_fuel,
            "num_alternatives": request.num_alternatives,
            "risk_by_cell": request.risk_by_cell,
        },
        task_id=job_id,
    )

    return RouteJobResponse(
        job_id=job_id,
        request_id=job_id,
        park_id=settings.PARK_ID,
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


async def get_routes(
    db: "AsyncSession",
    current_user: "User",
    request_id=None,
    park_id=None,
    page=1,
    page_size=20,
):
    """Return job status and (paginated) results for a route request.

    If the job exists, get its status and requested/found counts from the Celery
    result backend, then return the job's results with pagination.

    If request_id is provided, it must match a route_jobs row owned by the
    current user. Otherwise, return a 404 (see
    route_job_repository.route_job_exists_for_user).

    If request_id is not provided, return an empty result. route_jobs only
    supports looking up a single job by ID; it does not support browsing or
    filtering by park_id.
    """
    if request_id is None:
        return RouteListResponse(
            total=0,
            page=page,
            page_size=page_size,
            results=[],
        )

    if not await route_job_repository.route_job_exists_for_user(
        db,
        request_id,
        current_user.id,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route job not found",
        )

    result = celery_app.AsyncResult(request_id)
    status_value = CELERY_STATUS_MAP.get(result.state, result.state.lower())

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
        status=status_value,
        num_alternatives_requested=num_requested,
        num_alternatives_found=num_found,
        total=len(routes),
        page=page,
        page_size=page_size,
        results=page_results,
    )


def _to_wkt_point(point) -> str:
    lon, lat = point.coordinates
    return f"POINT({lon} {lat})"


def _to_wkt_linestring(line) -> str:
    coords = ", ".join(f"{lon} {lat}" for lon, lat in line.coordinates)
    return f"LINESTRING({coords})"


async def save_route(
    db: "AsyncSession",
    current_user: "User",
    req: "SaveRouteRequest",
) -> SavedRouteResponse:
    repo = PatrolRouteRepository(db)
    result = await repo.create(
        user_id=current_user.id,
        request_id=req.request_id,
        start_point_wkt=_to_wkt_point(req.start_point),
        end_point_wkt=_to_wkt_point(req.end_point),
        max_time=req.max_time,
        max_fuel=req.max_fuel,
        risk_heatmap=req.risk_by_cell,
        path_wkt=_to_wkt_linestring(req.route.path_geometry),
        estimated_time=req.route.estimated_time_min,
        estimated_fuel=req.route.estimated_fuel_l,
        risk_coverage=req.route.risk_coverage,
    )
    return SavedRouteResponse(
        id=result["id"],
        request_id=req.request_id,
        start_point=req.start_point,
        end_point=req.end_point,
        max_time=req.max_time,
        max_fuel=req.max_fuel,
        risk_by_cell=req.risk_by_cell,
        path_geometry=req.route.path_geometry,
        estimated_time_min=req.route.estimated_time_min,
        estimated_fuel_l=req.route.estimated_fuel_l,
        risk_coverage=req.route.risk_coverage,
        created_at=result["created_at"].isoformat(),
    )


async def list_saved_routes(
    db: "AsyncSession",
    current_user: "User",
    page: int,
    page_size: int,
) -> SavedRouteListResponse:
    repo = PatrolRouteRepository(db)
    rows, total = await repo.list_by_user(current_user.id, page, page_size)
    results = [
        SavedRouteResponse(
            id=r["id"],
            request_id=r["request_id"],
            start_point=r["start_point"],
            end_point=r["end_point"],
            max_time=r["max_time"],
            max_fuel=r["max_fuel"],
            risk_by_cell=r["risk_heatmap"],
            path_geometry=r["path_geometry"],
            estimated_time_min=r["estimated_time"],
            estimated_fuel_l=r["estimated_fuel"],
            risk_coverage=r["risk_coverage"],
            created_at=r["created_at"].isoformat(),
        )
        for r in rows
    ]
    return SavedRouteListResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=results,
    )


async def delete_saved_route(
    db: "AsyncSession",
    current_user: "User",
    route_id: str,
) -> bool:
    repo = PatrolRouteRepository(db)
    return await repo.delete(route_id, current_user.id)
