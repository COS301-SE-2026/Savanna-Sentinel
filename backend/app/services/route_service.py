import uuid
from datetime import datetime, timezone

from app.models.route_job import RouteJob
from app.schemas.route import RouteJobResponse, RouteRequest
from app.workers.tasks.route_tasks import run_route_planning_job


async def generate_route_job(request: RouteRequest, user) -> RouteJobResponse:
    """Validates preconditions, creates a RouteJob record (queued),
    enqueues background job, returns 202 payload."""
    job_id = str(uuid.uuid4())
    job = RouteJob(
        request_id=str(uuid.uuid4()),
        park_id=request.park_id,
        status="queued",
        num_alternatives_requested=request.num_alternatives,
        num_alternatives_found=0,
    )

    run_route_planning_job.delay(job_id)

    return RouteJobResponse(
        job_id=job_id,
        request_id=job.request_id,
        park_id=job.park_id,
        status=job.status,
        queued_at=datetime.now(timezone.utc).isoformat(),
    )

async def get_routes(db, user, request_id=None, park_id=None, page=1, page_size=20):
    """Read path, when request_id is provided also loads and returns
    the RouteJobs status and requested/found counts."""